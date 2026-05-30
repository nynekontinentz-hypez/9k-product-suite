/**
 * ORI scoring engine tests — covers pure scoring functions, score levels,
 * remediation generation, and client data pre-fill mapping.
 * No database or server required.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  PILLARS,
  CHECKS,
  calculateORI,
  getScoreLevel,
  generateRemediation,
  prefillFromClient,
} = require('../lib/ori-engine');

// ── Scoring: all YES (optimal) ────────────────────────────────────────────────

describe('calculateORI', () => {
  it('all YES answers produce a score above 8', () => {
    const answers = {};
    for (const c of CHECKS) answers[c.key] = 'yes';
    const { overall, identity, continuity, resilience } = calculateORI(answers);
    assert.ok(overall >= 8, `Expected overall >= 8, got ${overall}`);
    assert.ok(identity >= 8, `Expected identity >= 8, got ${identity}`);
    assert.ok(continuity >= 8, `Expected continuity >= 8, got ${continuity}`);
    assert.ok(resilience >= 8, `Expected resilience >= 8, got ${resilience}`);
  });

  it('all NO answers produce a score at or near 0', () => {
    const answers = {};
    for (const c of CHECKS) answers[c.key] = 'no';
    const { overall, identity, continuity, resilience } = calculateORI(answers);
    assert.ok(overall <= 2, `Expected overall <= 2, got ${overall}`);
    assert.ok(identity >= 0, 'identity must be non-negative');
    assert.ok(continuity >= 0, 'continuity must be non-negative');
    assert.ok(resilience >= 0, 'resilience must be non-negative');
  });

  it('unanswered questions leave score near 5 (neutral baseline)', () => {
    const { overall } = calculateORI({});
    assert.ok(overall >= 4.5 && overall <= 5.5, `Expected ~5, got ${overall}`);
  });

  it('only MFA YES improves identity score above 5', () => {
    const { identity } = calculateORI({ mfa_enforced: 'yes' });
    assert.ok(identity > 5, `Expected identity > 5, got ${identity}`);
  });

  it('only MFA NO lowers identity score below 5', () => {
    const { identity } = calculateORI({ mfa_enforced: 'no' });
    assert.ok(identity < 5, `Expected identity < 5, got ${identity}`);
  });

  it('backup_exists NO produces continuity below 5', () => {
    const { continuity } = calculateORI({ backup_exists: 'no' });
    assert.ok(continuity < 5, `Expected continuity < 5, got ${continuity}`);
  });

  it('backup_exists and backup_tested YES push continuity above 8', () => {
    const { continuity } = calculateORI({ backup_exists: 'yes', backup_tested: 'yes' });
    assert.ok(continuity > 8, `Expected continuity > 8, got ${continuity}`);
  });

  it('pillar scores are clamped to [0, 10]', () => {
    const worst = {};
    for (const c of CHECKS) worst[c.key] = 'no';
    const { identity, continuity, resilience } = calculateORI(worst);
    assert.ok(identity >= 0 && identity <= 10);
    assert.ok(continuity >= 0 && continuity <= 10);
    assert.ok(resilience >= 0 && resilience <= 10);

    const best = {};
    for (const c of CHECKS) best[c.key] = 'yes';
    const r2 = calculateORI(best);
    assert.ok(r2.identity >= 0 && r2.identity <= 10);
    assert.ok(r2.continuity >= 0 && r2.continuity <= 10);
    assert.ok(r2.resilience >= 0 && r2.resilience <= 10);
  });

  it('overall is the average of the three pillar scores', () => {
    const answers = {
      mfa_enforced: 'yes', backup_exists: 'yes', antivirus_edr: 'yes',
    };
    const { overall, identity, continuity, resilience } = calculateORI(answers);
    const expected = parseFloat(((identity + continuity + resilience) / 3).toFixed(1));
    assert.equal(overall, expected);
  });

  it('scores are returned as numbers rounded to 1 decimal place', () => {
    const { overall, identity, continuity, resilience } = calculateORI({ mfa_enforced: 'yes' });
    for (const v of [overall, identity, continuity, resilience]) {
      assert.equal(typeof v, 'number');
      assert.ok(!isNaN(v));
      const decimals = v.toString().split('.')[1];
      assert.ok(!decimals || decimals.length <= 1, `Too many decimals: ${v}`);
    }
  });
});

// ── getScoreLevel ─────────────────────────────────────────────────────────────

describe('getScoreLevel', () => {
  it('9.0 → Optimal', () => {
    assert.equal(getScoreLevel(9.0).label, 'Optimal');
    assert.equal(getScoreLevel(9.0).cssClass, 'score-optimal');
  });

  it('8.0 → Optimal', () => {
    assert.equal(getScoreLevel(8.0).label, 'Optimal');
  });

  it('7.9 → Acceptable', () => {
    assert.equal(getScoreLevel(7.9).label, 'Acceptable');
    assert.equal(getScoreLevel(7.9).cssClass, 'score-acceptable');
  });

  it('6.0 → Acceptable', () => {
    assert.equal(getScoreLevel(6.0).label, 'Acceptable');
  });

  it('5.9 → Caution', () => {
    assert.equal(getScoreLevel(5.9).label, 'Caution');
    assert.equal(getScoreLevel(5.9).cssClass, 'score-caution');
  });

  it('4.0 → Caution', () => {
    assert.equal(getScoreLevel(4.0).label, 'Caution');
  });

  it('3.9 → Critical', () => {
    assert.equal(getScoreLevel(3.9).label, 'Critical');
    assert.equal(getScoreLevel(3.9).cssClass, 'score-critical');
  });

  it('0 → Critical', () => {
    assert.equal(getScoreLevel(0).label, 'Critical');
  });

  it('returns a color string for every level', () => {
    for (const score of [0, 3, 5, 6, 8, 10]) {
      const { color } = getScoreLevel(score);
      assert.ok(typeof color === 'string' && color.startsWith('#'), `Bad color for score ${score}: ${color}`);
    }
  });
});

// ── generateRemediation ───────────────────────────────────────────────────────

describe('generateRemediation', () => {
  it('returns nothing when all answers are YES', () => {
    const answers = {};
    for (const c of CHECKS) answers[c.key] = 'yes';
    const items = generateRemediation(answers);
    assert.equal(items.length, 0);
  });

  it('returns an item for each NO answer', () => {
    const answers = { mfa_enforced: 'no', backup_exists: 'no', antivirus_edr: 'no' };
    const items = generateRemediation(answers);
    const keys = items.map(i => i.key);
    assert.ok(keys.includes('mfa_enforced'));
    assert.ok(keys.includes('backup_exists'));
    assert.ok(keys.includes('antivirus_edr'));
  });

  it('critical items sort before high, high before medium', () => {
    const answers = {};
    for (const c of CHECKS) answers[c.key] = 'no';
    const items = generateRemediation(answers);
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    for (let i = 1; i < items.length; i++) {
      assert.ok(
        order[items[i].priority] >= order[items[i - 1].priority],
        `Out of order: ${items[i - 1].priority} before ${items[i].priority}`
      );
    }
  });

  it('each item has required fields', () => {
    const answers = { mfa_enforced: 'no' };
    const [item] = generateRemediation(answers);
    assert.ok(item.key);
    assert.ok(item.pillar);
    assert.ok(item.pillarLabel);
    assert.ok(item.priority);
    assert.ok(item.question);
    assert.ok(item.recommendation);
    assert.ok(item.service);
  });

  it('includes critical checks with unanswered (missing) responses', () => {
    // Critical checks should appear as remediation items even if unanswered
    const items = generateRemediation({});
    const criticalChecks = CHECKS.filter(c => c.priority === 'critical');
    for (const c of criticalChecks) {
      assert.ok(items.some(i => i.key === c.key), `Missing critical check: ${c.key}`);
    }
  });
});

// ── prefillFromClient ─────────────────────────────────────────────────────────

describe('prefillFromClient', () => {
  it('maps uses_cloud_backup=1 to backup_exists=yes', () => {
    const result = prefillFromClient({ uses_cloud_backup: 1 });
    assert.equal(result.backup_exists, 'yes');
  });

  it('maps uses_cloud_backup=0 to backup_exists=no', () => {
    const result = prefillFromClient({ uses_cloud_backup: 0 });
    assert.equal(result.backup_exists, 'no');
  });

  it('maps uses_antivirus=1 to antivirus_edr=yes', () => {
    const result = prefillFromClient({ uses_antivirus: 1 });
    assert.equal(result.antivirus_edr, 'yes');
  });

  it('maps uses_firewall=1 to firewall=yes', () => {
    const result = prefillFromClient({ uses_firewall: 1 });
    assert.equal(result.firewall, 'yes');
  });

  it('maps uses_vpn=1 to vpn_remote=yes', () => {
    const result = prefillFromClient({ uses_vpn: 1 });
    assert.equal(result.vpn_remote, 'yes');
  });

  it('omits keys when client field is null/undefined', () => {
    const result = prefillFromClient({ uses_cloud_backup: null });
    assert.equal(result.backup_exists, undefined);
  });

  it('returns empty object for null client', () => {
    const result = prefillFromClient(null);
    assert.deepEqual(result, {});
  });

  it('maps all four supported fields simultaneously', () => {
    const result = prefillFromClient({
      uses_cloud_backup: 1,
      uses_antivirus: 0,
      uses_firewall: 1,
      uses_vpn: 0,
    });
    assert.equal(result.backup_exists, 'yes');
    assert.equal(result.antivirus_edr, 'no');
    assert.equal(result.firewall, 'yes');
    assert.equal(result.vpn_remote, 'no');
  });
});

// ── CHECKS and PILLARS shape ──────────────────────────────────────────────────

describe('engine data integrity', () => {
  it('all CHECKS have required fields', () => {
    for (const c of CHECKS) {
      assert.ok(c.key, `Missing key: ${JSON.stringify(c)}`);
      assert.ok(['identity', 'continuity', 'resilience'].includes(c.pillar), `Bad pillar: ${c.key}`);
      assert.ok(c.question, `Missing question: ${c.key}`);
      assert.ok(typeof c.yesImpact === 'number', `Bad yesImpact: ${c.key}`);
      assert.ok(typeof c.noImpact === 'number', `Bad noImpact: ${c.key}`);
      assert.ok(['critical', 'high', 'medium', 'low'].includes(c.priority), `Bad priority: ${c.key}`);
      assert.ok(c.recommendation, `Missing recommendation: ${c.key}`);
      assert.ok(c.service, `Missing service: ${c.key}`);
    }
  });

  it('exactly 6 checks per pillar', () => {
    for (const pillar of ['identity', 'continuity', 'resilience']) {
      const count = CHECKS.filter(c => c.pillar === pillar).length;
      assert.equal(count, 6, `Expected 6 checks for pillar '${pillar}', got ${count}`);
    }
  });

  it('all check keys are unique', () => {
    const keys = CHECKS.map(c => c.key);
    const unique = new Set(keys);
    assert.equal(unique.size, keys.length, 'Duplicate check key found');
  });

  it('PILLARS has entries for all three pillars', () => {
    assert.ok(PILLARS.identity);
    assert.ok(PILLARS.continuity);
    assert.ok(PILLARS.resilience);
  });
});
