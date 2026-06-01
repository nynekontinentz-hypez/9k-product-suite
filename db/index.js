const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL || path.join(__dirname, '..', 'data', 'portal.db');
const isPostgres = DATABASE_URL.startsWith('postgres');

let _db;

function getDb() {
  if (_db) return _db;
  if (isPostgres) {
    const { Pool } = require('pg');
    _db = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
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

// Unified async query interface
async function query(sql, params = []) {
  if (isPostgres) {
    const pool = getDb();
    const isOrIgnore = /^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql);
    let pgSql = sql.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i, 'INSERT INTO');
    let i = 0;
    pgSql = pgSql.replace(/\?/g, () => `$${++i}`);
    if (isOrIgnore) pgSql = pgSql.trimEnd() + ' ON CONFLICT DO NOTHING';
    const res = await pool.query(pgSql, params);
    return res.rows;
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

// Run raw DDL (CREATE TABLE, etc.) — node:sqlite uses .exec() for multi-statement
async function exec(sql) {
  if (isPostgres) {
    const pool = getDb();
    const pgSql = sql
      .replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, 'SERIAL PRIMARY KEY')
      .replace(/\bTEXT\s+DEFAULT\s+\(datetime\s*\(\s*'now'\s*\)\s*\)/gi, 'TIMESTAMPTZ DEFAULT NOW()');
    for (const stmt of pgSql.split(';').map(s => s.trim()).filter(Boolean)) {
      await pool.query(stmt);
    }
    return;
  }
  getDb().exec(sql);
}

module.exports = { query, queryOne, exec, isPostgres, getDb };
