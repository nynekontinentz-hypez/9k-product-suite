const { queryOne, query } = require('./index');

module.exports = {
  overview: async () => {
    const [tickets, clients, recentActivity] = await Promise.all([
      queryOne(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
          SUM(CASE WHEN urgency = 'critical' AND status != 'closed' THEN 1 ELSE 0 END) AS critical_open
        FROM tickets
      `),
      queryOne(`SELECT COUNT(*) AS total, SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active FROM clients`),
      query(`
        SELECT t.id, t.title, t.status, t.updated_at, c.company_name
        FROM tickets t JOIN clients c ON t.client_id = c.id
        ORDER BY t.updated_at DESC LIMIT 5
      `),
    ]);
    return {
      tickets: tickets || { total: 0, open: 0, in_progress: 0, critical_open: 0 },
      clients: clients || { total: 0, active: 0 },
      recentActivity: recentActivity || [],
    };
  },
};
