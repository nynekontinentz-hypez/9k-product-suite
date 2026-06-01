require('dotenv').config();
const path = require('path');
const fs = require('fs');

const { query, exec } = require('./db');

async function run() {
  await exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const files = fs.readdirSync(path.join(__dirname, 'migrations'))
    .filter(f => f.endsWith('.js'))
    .sort();

  for (const file of files) {
    const name = file.replace('.js', '');
    const existing = await query(`SELECT id FROM _migrations WHERE name = ?`, [name]);
    if (existing.length > 0) {
      console.log(`  skip  ${name}`);
      continue;
    }
    const migration = require(path.join(__dirname, 'migrations', file));
    // Support both string DDL and function migrations
    if (typeof migration.up === 'function') {
      await migration.up({ query, exec });
    } else {
      await exec(migration.up);
    }
    await query(`INSERT INTO _migrations (name) VALUES (?)`, [name]);
    console.log(`  apply ${name}`);
  }

  await seedDefaults();
  console.log('Migrations complete.');
  process.exit(0);
}

async function seedDefaults() {
  const tiers = await query(`SELECT id FROM service_tiers LIMIT 1`);
  if (tiers.length > 0) return;

  await exec(`INSERT INTO service_tiers (name, description, monthly_price, features) VALUES
    ('Essentials', 'Basic monitoring and support for small teams', 299, 'Endpoint monitoring,Remote support,Monthly check-in'),
    ('Professional', 'Full managed IT + M365 administration', 599, 'All Essentials,Microsoft 365 admin,Cybersecurity baseline,Priority tickets'),
    ('Enterprise', 'Comprehensive MSP coverage', 999, 'All Professional,MFA enforcement,Security awareness training,Dedicated technician')`);

  await exec(`INSERT INTO sla_tiers (name, response_hours, resolution_hours, description) VALUES
    ('Critical', 1, 4, 'System down, business impact'),
    ('High', 4, 24, 'Major degradation'),
    ('Normal', 8, 72, 'Standard support request'),
    ('Low', 24, 168, 'Minor issue or enhancement')`);

  const bcrypt = require('bcryptjs');

  // SECURITY: never seed a known default password in production
  const adminPass = process.env.ADMIN_SEED_PASSWORD;
  if (!adminPass && process.env.NODE_ENV === 'production') {
    console.warn('WARN: No ADMIN_SEED_PASSWORD set — skipping admin seed in production.');
    return;
  }
  const hash = await bcrypt.hash(adminPass || 'change-me-on-first-login', 12);
  await query(`INSERT OR IGNORE INTO admin_users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
    ['9K Admin', 'admin@9ksystems.net', hash, 'admin']);
}

run().catch(e => { console.error(e); process.exit(1); });
