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
    const res = await pool.query(sql, params);
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
function exec(sql) {
  if (isPostgres) return;
  getDb().exec(sql);
}

module.exports = { query, queryOne, exec, isPostgres, getDb };
