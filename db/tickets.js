const { query, queryOne } = require('./index');

const SELECT_BASE = `
  SELECT t.*, c.company_name, c.primary_contact_name,
    sl.name AS sla_name, sl.response_hours, sl.resolution_hours,
    au.name AS assigned_name
  FROM tickets t
  JOIN clients c ON t.client_id = c.id
  LEFT JOIN sla_tiers sl ON t.sla_tier_id = sl.id
  LEFT JOIN admin_users au ON t.assigned_admin_id = au.id
`;

module.exports = {
  findAll: (filters = {}) => {
    let where = [];
    let params = [];
    if (filters.status) { where.push(`t.status = ?`); params.push(filters.status); }
    if (filters.client_id) { where.push(`t.client_id = ?`); params.push(filters.client_id); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return query(`${SELECT_BASE} ${clause} ORDER BY t.urgency = 'critical' DESC, t.created_at DESC`, params);
  },

  findById: (id) => queryOne(`${SELECT_BASE} WHERE t.id = ?`, [id]),

  findByClient: (clientId) =>
    query(`${SELECT_BASE} WHERE t.client_id = ? ORDER BY t.created_at DESC`, [clientId]),

  create: async (data) => {
    // Compute SLA due date based on urgency
    const slaMap = { critical: 1, high: 4, normal: 8, low: 24 };
    const hoursAhead = slaMap[data.urgency] || 8;
    const slaTier = await queryOne(`SELECT id FROM sla_tiers WHERE response_hours = ?`, [hoursAhead]);
    const rows = await query(
      `INSERT INTO tickets (client_id, title, description, category, urgency, affected_asset,
        client_env_tag, sla_tier_id, sla_due_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`,
      [data.client_id, data.title, data.description, data.category || 'general',
       data.urgency || 'normal', data.affected_asset || null, data.client_env_tag || 'unknown',
       slaTier?.id || null, `+${hoursAhead} hours`]
    );
    return rows[0].lastID;
  },

  updateStatus: (id, status, adminId) =>
    query(
      `UPDATE tickets SET status = ?, updated_at = datetime('now'), closed_at = CASE WHEN ? = 'closed' THEN datetime('now') ELSE closed_at END,
       assigned_admin_id = COALESCE(assigned_admin_id, ?) WHERE id = ?`,
      [status, status, adminId, id]
    ),

  addUpdate: (ticketId, authorType, authorId, content, internal = false) =>
    query(
      `INSERT INTO ticket_updates (ticket_id, author_type, author_id, content, internal) VALUES (?, ?, ?, ?, ?)`,
      [ticketId, authorType, authorId, content, internal ? 1 : 0]
    ),

  getUpdates: (ticketId, includeInternal = false) => {
    const filter = includeInternal ? '' : `AND tu.internal = 0`;
    return query(
      `SELECT tu.*, au.name AS admin_name
       FROM ticket_updates tu
       LEFT JOIN admin_users au ON tu.author_type = 'admin' AND tu.author_id = au.id
       WHERE tu.ticket_id = ? ${filter} ORDER BY tu.created_at ASC`,
      [ticketId]
    );
  },

  setResolution: (id, resolutionNotes, clientSummary, rootCause) =>
    query(
      `UPDATE tickets SET resolution_notes = ?, client_visible_summary = ?, root_cause_category = ?, updated_at = datetime('now') WHERE id = ?`,
      [resolutionNotes, clientSummary, rootCause, id]
    ),

  stats: () => queryOne(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed,
      SUM(CASE WHEN urgency = 'critical' AND status != 'closed' THEN 1 ELSE 0 END) AS critical_open
    FROM tickets
  `),
};
