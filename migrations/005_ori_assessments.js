module.exports = {
  up: `
    CREATE TABLE IF NOT EXISTS ori_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      responses TEXT NOT NULL,
      identity_score REAL NOT NULL,
      continuity_score REAL NOT NULL,
      resilience_score REAL NOT NULL,
      overall_score REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ori_client ON ori_assessments(client_id);
    ALTER TABLE clients ADD COLUMN ori_preferences TEXT;
  `
};
