const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL || path.join(__dirname, '..', 'data', 'portal.db');
const isPostgres = DATABASE_URL.startsWith('postgres');

let _db;

function getDb() {
  if (_db) return _db;
  if (isPostgres) {
    const { Pool } = require('pg');
    // SSL is required by managed Postgres (e.g. Render) and on by default; set
    // DATABASE_SSL=disable for a local/self-hosted server that doesn't offer it.
    const ssl = process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false };
    _db = new Pool({ connectionString: DATABASE_URL, ssl });
  } else {
    // Node.js 22.5+ built-in SQLite — no native compilation required
    const { DatabaseSync } = require('node:sqlite');
    const isMemory = DATABASE_URL === ':memory:';
    if (!isMemory) {
      const dir = path.dirname(path.resolve(DATABASE_URL));
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
    _db = new DatabaseSync(isMemory ? ':memory:' : path.resolve(DATABASE_URL));
    if (!isMemory) _db.exec(`PRAGMA journal_mode = WAL`);
    _db.exec(`PRAGMA foreign_keys = ON`);
  }
  return _db;
}

// ── SQLite → Postgres translation ──────────────────────────────────────────────
// The application's SQL is authored in SQLite dialect. These pure helpers rewrite
// it to valid Postgres so the same query strings work against either backend.

// Rewrite a parameterized DML/SELECT statement for Postgres.
function pgRewrite(sql) {
  const isOrIgnore = /^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql);
  let s = sql.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i, 'INSERT INTO');

  // SQLite datetime() → Postgres timestamp expressions. Two-arg modifier forms
  // ('+48 hours', '-7 days', …) map cleanly onto Postgres interval literals.
  s = s
    .replace(/datetime\(\s*'now'\s*,\s*\?\s*\)/gi, '(NOW() + (?)::interval)')
    .replace(/datetime\(\s*'now'\s*,\s*'([^']*)'\s*\)/gi, "(NOW() + '$1'::interval)")
    .replace(/datetime\(\s*'now'\s*\)/gi, 'NOW()');

  const isInsert = /^\s*INSERT\s+INTO\b/i.test(s);
  if (isOrIgnore) s = s.replace(/\s*;?\s*$/, '') + ' ON CONFLICT DO NOTHING';
  // node:sqlite exposes lastInsertRowid; emulate via RETURNING id (all tables use id).
  if (isInsert && !/\bRETURNING\b/i.test(s)) s = s.replace(/\s*;?\s*$/, '') + ' RETURNING id';

  // Positional ? → $1, $2, … (after rewrites so injected ? placeholders are counted).
  let n = 0;
  s = s.replace(/\?/g, () => `$${++n}`);
  return s;
}

// Rewrite raw DDL for Postgres.
function pgDDL(sql) {
  return sql
    .replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, 'SERIAL PRIMARY KEY')
    .replace(/\bTEXT\s+DEFAULT\s+\(\s*datetime\s*\(\s*'now'\s*\)\s*\)/gi, 'TIMESTAMPTZ DEFAULT NOW()')
    // Bare *_at columns hold timestamps; Postgres needs a real timestamp type so
    // NOW()/interval assignments and comparisons type-check (no implicit text cast).
    .replace(/\b(\w*_at)\s+TEXT\b/gi, '$1 TIMESTAMPTZ');
}

// Unified async query interface
async function query(sql, params = []) {
  if (isPostgres) {
    const pool = getDb();
    const isRead = /^\s*(select|with|pragma)\b/i.test(sql);
    const res = await pool.query(pgRewrite(sql), params);
    if (isRead) return res.rows;
    const lastID = res.rows && res.rows[0] ? res.rows[0].id : undefined;
    return [{ lastID, changes: res.rowCount }];
  } else {
    const db = getDb();
    const lower = sql.trim().toLowerCase();
    const isRead = lower.startsWith('select') || lower.startsWith('with') || lower.startsWith('pragma');
    if (isRead) {
      const stmt = db.prepare(sql);
      return stmt.all(...params);
    } else {
      const stmt = db.prepare(sql);
      const info = stmt.run(...params);
      return [{ lastID: info.lastInsertRowid, changes: info.changes }];
    }
  }
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// Run raw DDL (CREATE TABLE, etc.) — node:sqlite uses .exec() for multi-statement.
async function exec(sql) {
  if (isPostgres) {
    const pool = getDb();
    const translated = pgDDL(sql);
    // Postgres has no multi-statement exec via the parameterized path — split and run.
    for (const stmt of translated.split(';').map(s => s.trim()).filter(Boolean)) {
      await pool.query(stmt);
    }
    return;
  }
  getDb().exec(sql);
}

module.exports = { query, queryOne, exec, isPostgres, getDb, pgRewrite, pgDDL };
