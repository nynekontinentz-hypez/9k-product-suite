const { query, queryOne } = require('./index');

module.exports = {
  findByClient: (clientId) => query(`
    SELECT con.*, st.name AS tier_name
    FROM contracts con
    LEFT JOIN service_tiers st ON con.service_tier_id = st.id
    WHERE con.client_id = ? ORDER BY con.start_date DESC
  `, [clientId]),

  findActive: (clientId) => queryOne(`
    SELECT con.*, st.name AS tier_name, st.features
    FROM contracts con
    LEFT JOIN service_tiers st ON con.service_tier_id = st.id
    WHERE con.client_id = ? AND con.status = 'active' ORDER BY con.start_date DESC LIMIT 1
  `, [clientId]),

  create: (data) => query(
    `INSERT INTO contracts (client_id, service_tier_id, start_date, end_date, monthly_rate, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.client_id, data.service_tier_id || null, data.start_date,
     data.end_date || null, data.monthly_rate, data.notes || null]
  ),
};
