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

async function getLatestScoresForAll() {
  const rows = await query(
    `SELECT oa.client_id, oa.overall_score, oa.created_at
     FROM ori_assessments oa
     INNER JOIN (
       SELECT client_id, MAX(id) AS max_id FROM ori_assessments GROUP BY client_id
     ) latest ON oa.client_id = latest.client_id AND oa.id = latest.max_id`
  );
  const map = {};
  for (const row of rows) map[row.client_id] = row;
  return map;
}

module.exports = { saveAssessment, getLatestAssessment, getAssessmentHistory, getAssessmentById, getLatestScoresForAll };
