const { query, queryOne } = require('./index');

async function saveAssessment(clientId, responses, scores) {
  const result = await query(
    `INSERT INTO ori_assessments
       (client_id, responses, identity_score, continuity_score, resilience_score, overall_score)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [clientId, JSON.stringify(responses), scores.identity, scores.continuity, scores.resilience, scores.overall]
  );
  return result[0].lastID;
}

async function getLatestAssessment(clientId) {
  return queryOne(
    `SELECT * FROM ori_assessments WHERE client_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
    [clientId]
  );
}

async function getAssessmentHistory(clientId, limit = 6) {
  return query(
    `SELECT id, overall_score, identity_score, continuity_score, resilience_score, created_at
     FROM ori_assessments WHERE client_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
    [clientId, limit]
  );
}

async function getAssessmentById(id, clientId) {
  return queryOne(
    `SELECT * FROM ori_assessments WHERE id = ? AND client_id = ?`,
    [id, clientId]
  );
}

module.exports = { saveAssessment, getLatestAssessment, getAssessmentHistory, getAssessmentById };
