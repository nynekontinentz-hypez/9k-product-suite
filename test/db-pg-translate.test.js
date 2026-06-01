const { test } = require('node:test');
const assert = require('node:assert');
const { pgRewrite, pgDDL } = require('../db/index');

// ── pgRewrite: parameterized DML/SELECT ───────────────────────────────────────
test('pgRewrite: converts positional ? to $N', () => {
  assert.strictEqual(
    pgRewrite('SELECT * FROM clients WHERE id = ? AND active = ?'),
    'SELECT * FROM clients WHERE id = $1 AND active = $2'
  );
});

test('pgRewrite: appends RETURNING id to INSERT (for lastID emulation)', () => {
  assert.strictEqual(
    pgRewrite('INSERT INTO clients (company_name) VALUES (?)'),
    'INSERT INTO clients (company_name) VALUES ($1) RETURNING id'
  );
});

test('pgRewrite: does not append RETURNING when already present', () => {
  const out = pgRewrite('INSERT INTO clients (company_name) VALUES (?) RETURNING id');
  assert.strictEqual(out, 'INSERT INTO clients (company_name) VALUES ($1) RETURNING id');
  assert.strictEqual((out.match(/RETURNING/gi) || []).length, 1);
});

test('pgRewrite: INSERT OR IGNORE → ON CONFLICT DO NOTHING + RETURNING id', () => {
  assert.strictEqual(
    pgRewrite('INSERT OR IGNORE INTO admin_users (name, email) VALUES (?, ?)'),
    'INSERT INTO admin_users (name, email) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id'
  );
});

test('pgRewrite: does not append RETURNING to UPDATE/DELETE/SELECT', () => {
  assert.strictEqual(
    pgRewrite('UPDATE tickets SET status = ? WHERE id = ?'),
    'UPDATE tickets SET status = $1 WHERE id = $2'
  );
  assert.strictEqual(
    pgRewrite('DELETE FROM tickets WHERE id = ?'),
    'DELETE FROM tickets WHERE id = $1'
  );
  assert.ok(!/RETURNING/i.test(pgRewrite('SELECT * FROM tickets WHERE id = ?')));
});

test('pgRewrite: datetime(now) → NOW()', () => {
  assert.strictEqual(
    pgRewrite("UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?"),
    'UPDATE admin_users SET last_login_at = NOW() WHERE id = $1'
  );
});

test('pgRewrite: datetime(now, literal modifier) → interval', () => {
  assert.strictEqual(
    pgRewrite("INSERT INTO client_auth (invite_expires_at) VALUES (datetime('now', '+48 hours'))"),
    "INSERT INTO client_auth (invite_expires_at) VALUES ((NOW() + '+48 hours'::interval)) RETURNING id"
  );
});

test('pgRewrite: datetime(now, ?) keeps placeholder ordering correct', () => {
  // The interval ? must be numbered in positional order with the other params.
  assert.strictEqual(
    pgRewrite("INSERT INTO tickets (client_id, title, sla_due_at) VALUES (?, ?, datetime('now', ?))"),
    'INSERT INTO tickets (client_id, title, sla_due_at) VALUES ($1, $2, (NOW() + ($3)::interval)) RETURNING id'
  );
});

test('pgRewrite: WHERE datetime(now) comparison translates', () => {
  assert.strictEqual(
    pgRewrite("SELECT * FROM page_views WHERE created_at > datetime('now', ?)"),
    'SELECT * FROM page_views WHERE created_at > (NOW() + ($1)::interval)'
  );
});

// ── pgDDL: schema ─────────────────────────────────────────────────────────────
test('pgDDL: INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY', () => {
  assert.match(pgDDL('id INTEGER PRIMARY KEY AUTOINCREMENT'), /id SERIAL PRIMARY KEY/);
});

test('pgDDL: TEXT DEFAULT (datetime(now)) → TIMESTAMPTZ DEFAULT NOW()', () => {
  assert.match(
    pgDDL("created_at TEXT DEFAULT (datetime('now'))"),
    /created_at TIMESTAMPTZ DEFAULT NOW\(\)/
  );
});

test('pgDDL: bare *_at TEXT columns → TIMESTAMPTZ', () => {
  assert.match(pgDDL('last_login_at TEXT,'), /last_login_at TIMESTAMPTZ,/);
  assert.match(pgDDL('invite_expires_at TEXT,'), /invite_expires_at TIMESTAMPTZ,/);
  assert.match(pgDDL('sla_due_at TEXT,'), /sla_due_at TIMESTAMPTZ,/);
  assert.match(pgDDL('closed_at TEXT'), /closed_at TIMESTAMPTZ/);
});

test('pgDDL: does not convert non-_at TEXT columns', () => {
  assert.match(pgDDL('start_date TEXT NOT NULL'), /start_date TEXT NOT NULL/);
  assert.match(pgDDL('affected_asset TEXT'), /affected_asset TEXT/);
  assert.match(pgDDL("client_env_tag TEXT DEFAULT 'unknown'"), /client_env_tag TEXT DEFAULT 'unknown'/);
});

test('pgDDL: created_at default form is not double-converted by bare-_at rule', () => {
  const out = pgDDL("created_at TEXT DEFAULT (datetime('now'))");
  assert.match(out, /created_at TIMESTAMPTZ DEFAULT NOW\(\)/);
  assert.ok(!/TIMESTAMPTZ TIMESTAMPTZ/.test(out));
});
