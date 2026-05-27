const { query, queryOne } = require('./index');

const SELECT_BASE = `
  SELECT c.*, st.name AS tier_name, st.monthly_price AS tier_price
  FROM clients c
  LEFT JOIN service_tiers st ON c.service_tier_id = st.id
`;

module.exports = {
  findAll: () => query(`${SELECT_BASE} ORDER BY c.company_name`),

  findById: (id) => queryOne(`${SELECT_BASE} WHERE c.id = ?`, [id]),

  findByEmail: (email) => queryOne(
    `SELECT c.*, ca.password_hash, ca.invite_token, ca.invite_expires_at, ca.last_login_at, ca.id AS auth_id
     FROM clients c JOIN client_auth ca ON c.id = ca.client_id
     WHERE c.primary_contact_email = ? AND c.active = 1`, [email]
  ),

  create: async (data) => {
    const rows = await query(
      `INSERT INTO clients (company_name, primary_contact_name, primary_contact_email,
        billing_contact_email, phone, service_tier_id, environment, endpoint_count,
        uses_azure_ad, uses_microsoft_365, emergency_contact_name, emergency_contact_phone,
        internal_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.company_name, data.primary_contact_name, data.primary_contact_email,
       data.billing_contact_email || null, data.phone || null, data.service_tier_id || null,
       data.environment || 'hybrid', data.endpoint_count || 0,
       data.uses_azure_ad ? 1 : 0, data.uses_microsoft_365 ? 1 : 0,
       data.emergency_contact_name || null, data.emergency_contact_phone || null,
       data.internal_notes || null]
    );
    return rows[0].lastID;
  },

  setAuth: (clientId, passwordHash, inviteToken = null) =>
    query(
      `INSERT INTO client_auth (client_id, password_hash, invite_token, invite_expires_at)
       VALUES (?, ?, ?, datetime('now', '+48 hours'))
       ON CONFLICT(client_id) DO UPDATE SET
         password_hash = excluded.password_hash,
         invite_token = excluded.invite_token,
         invite_expires_at = excluded.invite_expires_at`,
      [clientId, passwordHash, inviteToken]
    ),

  updateLastLogin: (clientId) =>
    query(`UPDATE client_auth SET last_login_at = datetime('now') WHERE client_id = ?`, [clientId]),

  getHealth: () => query(`
    SELECT account_health, COUNT(*) as count FROM clients WHERE active = 1 GROUP BY account_health
  `),
};
