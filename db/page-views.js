const { query } = require('./index');

module.exports = {
  record: (path, actorType, actorId, ip, userAgent) =>
    query(
      `INSERT INTO page_views (path, actor_type, actor_id, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)`,
      [path, actorType || null, actorId || null, ip || null, userAgent || null]
    ),

  summary: (days = 30) => query(`
    SELECT path, COUNT(*) AS views
    FROM page_views
    WHERE created_at > datetime('now', ?)
    GROUP BY path ORDER BY views DESC LIMIT 20
  `, [`-${days} days`]),
};
