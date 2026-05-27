const { query, queryOne } = require('./index');

module.exports = {
  findAllService: () => query(`SELECT * FROM service_tiers ORDER BY monthly_price`),
  findAllSLA: () => query(`SELECT * FROM sla_tiers ORDER BY response_hours`),
  findServiceById: (id) => queryOne(`SELECT * FROM service_tiers WHERE id = ?`, [id]),
};
