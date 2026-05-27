const { query, queryOne } = require('./index');

module.exports = {
  findByEmail: (email) => queryOne(
    `SELECT * FROM admin_users WHERE email = ? AND active = 1`, [email]
  ),
  findById: (id) => queryOne(`SELECT * FROM admin_users WHERE id = ?`, [id]),
  findAll: () => query(`SELECT id, name, email, role, active, last_login_at FROM admin_users`),
  updateLastLogin: (id) =>
    query(`UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?`, [id]),
};
