/**
 * Test helpers — sets up an in-memory SQLite DB with full schema + seed data.
 * Uses node:sqlite (same as production) so tests exercise real query paths.
 */
const path = require('path');
const fs = require('fs');

/** Spin up a fresh in-memory DB, run migrations + seed defaults. */
function setupTestDb() {
  // Point db/index.js at an in-memory database before it's first required
  process.env.DATABASE_URL = ':memory:';

  // Clear cached db modules so each test file gets a fresh DB
  for (const key of Object.keys(require.cache)) {
    if (key.includes(path.join('9k-portal', 'db'))) delete require.cache[key];
  }

  const db = require('../db');
  const { exec, query } = db;

  // Apply migrations
  const migDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migDir).filter(f => f.endsWith('.js')).sort();
  for (const file of files) {
    // Clear cached migration modules too
    const migPath = path.join(migDir, file);
    delete require.cache[require.resolve(migPath)];
    const migration = require(migPath);
    if (typeof migration.up === 'function') {
      migration.up({ query, exec });
    } else {
      exec(migration.up);
    }
  }

  // Seed service tiers + SLA tiers
  exec(`INSERT INTO service_tiers (name, description, monthly_price, features) VALUES
    ('Essentials', 'Basic monitoring', 299, 'Endpoint monitoring,Remote support'),
    ('Professional', 'Full managed IT', 599, 'All Essentials,M365 admin,Cybersecurity'),
    ('Enterprise', 'Comprehensive MSP', 999, 'All Professional,Dedicated technician')`);

  exec(`INSERT INTO sla_tiers (name, response_hours, resolution_hours, description) VALUES
    ('Critical', 1, 4, 'System down'),
    ('High', 4, 24, 'Major degradation'),
    ('Normal', 8, 72, 'Standard request'),
    ('Low', 24, 168, 'Minor issue')`);

  return { exec, query };
}

/** Seed a demo client + auth + contract + tickets for integration tests. */
async function seedDemoData() {
  const { query } = require('../db');
  const bcrypt = require('bcryptjs');

  await query(
    `INSERT INTO clients (id, company_name, primary_contact_name, primary_contact_email, phone, service_tier_id, environment, endpoint_count, uses_microsoft_365, uses_azure_ad)
     VALUES (1, 'Acme Corp', 'Jamie Lee', 'jamie@acmecorp.com', '+1 555 100 2000', 2, 'hybrid', 18, 1, 1)`
  );

  const hash = await bcrypt.hash('portal1234', 4); // low rounds for speed
  await query(`INSERT INTO client_auth (client_id, password_hash) VALUES (1, ?)`, [hash]);

  await query(`INSERT INTO contracts (id, client_id, service_tier_id, start_date, monthly_rate, status)
     VALUES (1, 1, 2, '2026-01-01', 599, 'active')`);

  const adminHash = await bcrypt.hash('admin-pass', 4);
  await query(`INSERT INTO admin_users (id, name, email, password_hash, role) VALUES (1, '9K Admin', 'admin@9ksystems.net', ?, 'admin')`, [adminHash]);

  await query(
    `INSERT INTO tickets (id, client_id, title, description, category, urgency, status, affected_asset, client_env_tag)
     VALUES (1, 1, 'Outlook not connecting', 'Disconnected since morning.', 'email', 'high', 'in_progress', 'LAPTOP-JAMIE', 'hybrid')`
  );

  await query(
    `INSERT INTO tickets (id, client_id, title, description, category, urgency, status, client_env_tag)
     VALUES (2, 1, 'Shared drive permissions', 'Lost permissions after update.', 'connectivity', 'critical', 'open', 'on-prem')`
  );

  await query(
    `INSERT INTO ticket_updates (ticket_id, author_type, author_id, content, internal)
     VALUES (1, 'admin', 1, 'Investigating the issue.', 0)`
  );

  await query(
    `INSERT INTO ticket_updates (ticket_id, author_type, author_id, content, internal)
     VALUES (1, 'admin', 1, 'Internal: checking Exchange logs.', 1)`
  );
}

module.exports = { setupTestDb, seedDemoData };
