// client_auth holds exactly one credential row per client. The UNIQUE index both
// enforces that invariant and serves as the arbiter for setAuth()'s
// INSERT ... ON CONFLICT(client_id) DO UPDATE upsert (required by Postgres, and
// also required by SQLite for the ON CONFLICT target to resolve).
module.exports = {
  up: `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_auth_client ON client_auth(client_id);
  `
};
