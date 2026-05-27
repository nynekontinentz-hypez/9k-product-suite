const { query } = require('../db');

async function log(actorType, actorId, action, targetType = null, targetId = null, detail = null, ip = null) {
  try {
    await query(
      `INSERT INTO audit_log (actor_type, actor_id, action, target_type, target_id, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [actorType, actorId, action, targetType, targetId, detail ? JSON.stringify(detail) : null, ip]
    );
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
}

module.exports = { log };
