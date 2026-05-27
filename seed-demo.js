require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('./db');

async function seed() {
  // Demo client
  await query(
    `INSERT OR IGNORE INTO clients
     (id, company_name, primary_contact_name, primary_contact_email, phone, service_tier_id, environment, endpoint_count, uses_microsoft_365, uses_azure_ad)
     VALUES (1, 'Acme Corp', 'Jamie Lee', 'jamie@acmecorp.com', '+1 555 100 2000', 2, 'hybrid', 18, 1, 1)`
  );

  const hash = await bcrypt.hash('portal1234', 12);
  await query(
    `INSERT OR IGNORE INTO client_auth (client_id, password_hash) VALUES (1, ?)`,
    [hash]
  );

  await query(
    `INSERT OR IGNORE INTO contracts (id, client_id, service_tier_id, start_date, monthly_rate, status)
     VALUES (1, 1, 2, '2026-01-01', 599, 'active')`
  );

  await query(
    `INSERT OR IGNORE INTO tickets (id, client_id, title, description, category, urgency, status, affected_asset, client_env_tag, sla_due_at)
     VALUES (1, 1, 'Outlook not connecting to Exchange',
      'Since this morning, Outlook shows disconnected and will not load new email. Other M365 apps seem fine.',
      'email', 'high', 'in_progress', 'LAPTOP-JAMIE', 'hybrid', datetime('now', '+4 hours'))`
  );

  await query(
    `INSERT OR IGNORE INTO tickets (id, client_id, title, description, category, urgency, status, affected_asset, client_env_tag, sla_due_at)
     VALUES (2, 1, 'Shared drive permissions reset after Windows update',
      'The team drive on the file server lost all custom permissions after last night update. Users cannot access their folders.',
      'connectivity', 'critical', 'open', 'FILE-SERVER-01', 'on-prem', datetime('now', '+1 hour'))`
  );

  await query(
    `INSERT OR IGNORE INTO tickets (id, client_id, title, description, category, urgency, status, affected_asset, client_env_tag)
     VALUES (3, 1, 'New user account for Alex Reyes',
      'Starting Monday — Alex Reyes, alex@acmecorp.com. Needs M365 license, shared drive access, and Slack.',
      'account', 'low', 'closed', NULL, 'cloud')`
  );

  await query(
    `INSERT OR IGNORE INTO ticket_updates (id, ticket_id, author_type, author_id, content, internal)
     VALUES (1, 1, 'admin', 1, 'Checked Exchange admin centre — no service outage on tenant. Running autodiscover diagnostics.', 1)`
  );

  await query(
    `INSERT OR IGNORE INTO ticket_updates (id, ticket_id, author_type, author_id, content, internal)
     VALUES (2, 1, 'admin', 1, 'We are actively investigating the Outlook connection issue. Exchange services appear healthy — running diagnostics now. ETA: 2 hours.', 0)`
  );

  await query(
    `INSERT OR IGNORE INTO ticket_updates (id, ticket_id, author_type, author_id, content, internal)
     VALUES (3, 3, 'admin', 1, 'New user account created. Alex Reyes has been sent an M365 invite and shared drive access is configured.', 0)`
  );

  console.log('Demo data seeded successfully.');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
