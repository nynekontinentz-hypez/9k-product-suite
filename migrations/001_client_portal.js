// Core schema: clients, tickets, contracts, service_tiers, sla_tiers
module.exports = {
  up: `
    CREATE TABLE IF NOT EXISTS service_tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      monthly_price REAL DEFAULT 0,
      features TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sla_tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      response_hours INTEGER NOT NULL,
      resolution_hours INTEGER NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      primary_contact_name TEXT NOT NULL,
      primary_contact_email TEXT NOT NULL UNIQUE,
      billing_contact_email TEXT,
      phone TEXT,
      service_tier_id INTEGER REFERENCES service_tiers(id),
      environment TEXT DEFAULT 'hybrid',
      endpoint_count INTEGER DEFAULT 0,
      uses_azure_ad INTEGER DEFAULT 0,
      uses_microsoft_365 INTEGER DEFAULT 0,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      internal_notes TEXT,
      account_health TEXT DEFAULT 'good',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS client_auth (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      password_hash TEXT NOT NULL,
      invite_token TEXT,
      invite_expires_at TEXT,
      last_login_at TEXT,
      mfa_enabled INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      service_tier_id INTEGER REFERENCES service_tiers(id),
      start_date TEXT NOT NULL,
      end_date TEXT,
      monthly_rate REAL NOT NULL,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      urgency TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'open',
      affected_asset TEXT,
      client_env_tag TEXT DEFAULT 'unknown',
      escalation_level INTEGER DEFAULT 0,
      sla_tier_id INTEGER REFERENCES sla_tiers(id),
      sla_due_at TEXT,
      resolution_notes TEXT,
      client_visible_summary TEXT,
      assigned_admin_id INTEGER,
      root_cause_category TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS ticket_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      author_type TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      internal INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `
};
