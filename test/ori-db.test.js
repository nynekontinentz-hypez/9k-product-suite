/**
 * ORI database layer tests — covers saveAssessment, getLatestAssessment,
 * getAssessmentHistory, getAssessmentById against an in-memory SQLite DB.
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDb, seedDemoData } = require('./helpers');

const SAMPLE_RESPONSES = {
  mfa_enforced: 'yes',
  backup_exists: 'yes',
  antivirus_edr: 'no',
};

const SAMPLE_SCORES = {
  overall: 6.5,
  identity: 7.0,
  continuity: 8.0,
  resilience: 4.5,
};

describe('ORI DB layer', () => {
  before(async () => {
    setupTestDb();
    await seedDemoData();
  });

  describe('saveAssessment', () => {
    it('inserts a row and returns a numeric id', async () => {
      const ori = require('../db/ori');
      const id = await ori.saveAssessment(1, SAMPLE_RESPONSES, SAMPLE_SCORES);
      assert.equal(typeof id, 'number');
      assert.ok(id > 0);
    });

    it('stores scores exactly as provided', async () => {
      const ori = require('../db/ori');
      const id = await ori.saveAssessment(1, SAMPLE_RESPONSES, SAMPLE_SCORES);
      const row = await ori.getAssessmentById(id, 1);
      assert.equal(row.overall_score, SAMPLE_SCORES.overall);
      assert.equal(row.identity_score, SAMPLE_SCORES.identity);
      assert.equal(row.continuity_score, SAMPLE_SCORES.continuity);
      assert.equal(row.resilience_score, SAMPLE_SCORES.resilience);
    });

    it('stores responses as JSON-parseable text', async () => {
      const ori = require('../db/ori');
      const id = await ori.saveAssessment(1, SAMPLE_RESPONSES, SAMPLE_SCORES);
      const row = await ori.getAssessmentById(id, 1);
      const parsed = JSON.parse(row.responses);
      assert.equal(parsed.mfa_enforced, 'yes');
      assert.equal(parsed.backup_exists, 'yes');
      assert.equal(parsed.antivirus_edr, 'no');
    });
  });

  describe('getLatestAssessment', () => {
    it('returns the most recently created assessment', async () => {
      const ori = require('../db/ori');
      const id1 = await ori.saveAssessment(1, { mfa_enforced: 'no' }, { overall: 3.0, identity: 3.0, continuity: 5.0, resilience: 5.0 });
      const id2 = await ori.saveAssessment(1, { mfa_enforced: 'yes' }, { overall: 8.0, identity: 8.0, continuity: 5.0, resilience: 5.0 });
      const latest = await ori.getLatestAssessment(1);
      assert.equal(latest.id, id2);
      assert.equal(latest.overall_score, 8.0);
    });

    it('returns null for a client with no assessments', async () => {
      const ori = require('../db/ori');
      const latest = await ori.getLatestAssessment(9999);
      assert.equal(latest, null);
    });

    it('includes the client_id on the returned row', async () => {
      const ori = require('../db/ori');
      const latest = await ori.getLatestAssessment(1);
      assert.equal(latest.client_id, 1);
    });
  });

  describe('getAssessmentHistory', () => {
    it('returns an array', async () => {
      const ori = require('../db/ori');
      const history = await ori.getAssessmentHistory(1);
      assert.ok(Array.isArray(history));
    });

    it('returns assessments ordered newest first', async () => {
      const ori = require('../db/ori');
      const history = await ori.getAssessmentHistory(1);
      for (let i = 1; i < history.length; i++) {
        assert.ok(
          history[i - 1].created_at >= history[i].created_at,
          'History should be newest-first'
        );
      }
    });

    it('respects the limit parameter', async () => {
      const ori = require('../db/ori');
      // Seed several more to exceed the limit
      for (let i = 0; i < 5; i++) {
        await ori.saveAssessment(1, {}, { overall: i, identity: i, continuity: i, resilience: i });
      }
      const history = await ori.getAssessmentHistory(1, 3);
      assert.ok(history.length <= 3);
    });

    it('default limit is 6', async () => {
      const ori = require('../db/ori');
      const history = await ori.getAssessmentHistory(1);
      assert.ok(history.length <= 6);
    });

    it('returns empty array for unknown client', async () => {
      const ori = require('../db/ori');
      const history = await ori.getAssessmentHistory(8888);
      assert.deepEqual(history, []);
    });

    it('history rows include score and created_at but not responses', async () => {
      const ori = require('../db/ori');
      const history = await ori.getAssessmentHistory(1);
      assert.ok(history.length > 0);
      const row = history[0];
      assert.ok(typeof row.overall_score === 'number');
      assert.ok(row.created_at);
      assert.equal(row.responses, undefined, 'history rows should not include full responses');
    });
  });

  describe('getAssessmentById', () => {
    it('returns the correct assessment', async () => {
      const ori = require('../db/ori');
      const id = await ori.saveAssessment(1, SAMPLE_RESPONSES, SAMPLE_SCORES);
      const row = await ori.getAssessmentById(id, 1);
      assert.ok(row);
      assert.equal(row.id, id);
    });

    it('returns null for a non-existent id', async () => {
      const ori = require('../db/ori');
      const row = await ori.getAssessmentById(99999, 1);
      assert.equal(row, null);
    });

    it('returns null when client_id does not match (ownership guard)', async () => {
      const ori = require('../db/ori');
      const id = await ori.saveAssessment(1, SAMPLE_RESPONSES, SAMPLE_SCORES);
      // Client 999 should not be able to access client 1's assessment
      const row = await ori.getAssessmentById(id, 999);
      assert.equal(row, null);
    });

    it('returns full responses text in the row', async () => {
      const ori = require('../db/ori');
      const id = await ori.saveAssessment(1, SAMPLE_RESPONSES, SAMPLE_SCORES);
      const row = await ori.getAssessmentById(id, 1);
      assert.ok(typeof row.responses === 'string');
      assert.doesNotThrow(() => JSON.parse(row.responses));
    });
  });
});
