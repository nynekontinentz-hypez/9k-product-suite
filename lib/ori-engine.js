// Operational Resilience Index (ORI) scoring engine
// Scale: 0–10. Higher = healthier. 9–10 Optimal, 7–8 Acceptable, 4–6 Caution, 0–3 Critical.

const PILLARS = {
  identity: {
    id: 'identity',
    label: 'Identity & Access',
    icon: '◉',
    description: 'Controls governing who can access what — credentials, privileges, and lifecycle.',
    colorVar: '--ori-cyan',
  },
  continuity: {
    id: 'continuity',
    label: 'Data Integrity & Continuity',
    icon: '◈',
    description: 'Protection and recoverability of your critical business data.',
    colorVar: '--ori-gold',
  },
  resilience: {
    id: 'resilience',
    label: 'Operational Resilience',
    icon: '◎',
    description: 'Your systems\' ability to resist, detect, and recover from threats.',
    colorVar: '--ori-emerald',
  },
};

// Base pillar score = 5.0 (neutral). Each check adjusts up or down.
// Answer YES = yesImpact added. Answer NO = noImpact added (negative = subtracted).
// Unanswered = no change. Final pillar clamped to [0, 10].
const CHECKS = [
  // ── Pillar 1: Identity & Access ──────────────────────────────────────────
  {
    key: 'mfa_enforced',
    pillar: 'identity',
    question: 'Is multi-factor authentication (MFA) enforced for all user accounts?',
    hint: 'Includes email, cloud services, VPN, and internal tools.',
    yesImpact: 2.0, noImpact: -2.0,
    priority: 'critical',
    recommendation: 'Enable MFA on all accounts immediately. Use Microsoft Authenticator, Duo, or Google Authenticator. This is the highest-impact single security control available.',
    service: 'Cybersecurity',
    clientField: null,
  },
  {
    key: 'no_shared_creds',
    pillar: 'identity',
    question: 'Do all employees have individual accounts — no shared passwords or admin credentials?',
    hint: 'Shared credentials make breaches untraceable and access revocation impossible.',
    yesImpact: 1.25, noImpact: -1.5,
    priority: 'critical',
    recommendation: 'Provision individual accounts for every user. Shared credentials eliminate accountability and make access revocation impossible when staff leave.',
    service: 'Managed IT',
    clientField: null,
  },
  {
    key: 'password_manager',
    pillar: 'identity',
    question: 'Is a password manager deployed across your entire organization?',
    hint: 'e.g., Bitwarden, 1Password, or Keeper for Business.',
    yesImpact: 0.75, noImpact: -0.25,
    priority: 'high',
    recommendation: 'Deploy Bitwarden Teams or 1Password Business. Password managers eliminate weak and reused passwords — credential stuffing attacks rely on this gap.',
    service: 'Cybersecurity',
    clientField: null,
  },
  {
    key: 'least_privilege',
    pillar: 'identity',
    question: 'Are admin rights and elevated permissions limited to only those who require them?',
    hint: 'Standard users should never have local admin or global admin rights.',
    yesImpact: 0.75, noImpact: -0.5,
    priority: 'high',
    recommendation: 'Audit all accounts and remove unnecessary admin rights. Implement a request-and-approve process for any elevated access.',
    service: 'Managed IT',
    clientField: null,
  },
  {
    key: 'access_review',
    pillar: 'identity',
    question: 'Are user access rights reviewed and pruned at least quarterly?',
    hint: 'Former employees and role-changed staff should have access updated promptly.',
    yesImpact: 0.5, noImpact: -0.25,
    priority: 'medium',
    recommendation: 'Establish a quarterly access review. Review active accounts, permission levels, and deactivate stale or over-privileged accounts.',
    service: 'Managed IT',
    clientField: null,
  },
  {
    key: 'offboarding',
    pillar: 'identity',
    question: 'Is all IT access revoked on the same day an employee departs?',
    hint: 'Includes email, cloud apps, VPN, and any shared tools.',
    yesImpact: 0.5, noImpact: -0.5,
    priority: 'high',
    recommendation: 'Create a same-day IT offboarding checklist. Delayed access revocation is a primary vector for data exfiltration by departing employees.',
    service: 'Managed IT',
    clientField: null,
  },

  // ── Pillar 2: Data Integrity & Continuity ────────────────────────────────
  {
    key: 'backup_exists',
    pillar: 'continuity',
    question: 'Are automated backups configured and running for all critical business data?',
    hint: 'Local, cloud, or hybrid — this is the non-negotiable foundation.',
    yesImpact: 2.0, noImpact: -2.5,
    priority: 'critical',
    recommendation: 'Configure automated backups for all critical data immediately. Without a backup, any hardware failure, ransomware attack, or accidental deletion is permanent.',
    service: 'Cloud & Backup',
    clientField: 'uses_cloud_backup',
  },
  {
    key: 'backup_tested',
    pillar: 'continuity',
    question: 'Has a successful backup restoration been tested within the last 6 months?',
    hint: 'An untested backup is not a backup. Restoration failures are common.',
    yesImpact: 2.0, noImpact: -2.0,
    priority: 'critical',
    recommendation: 'Schedule a backup restoration test this month. Many organizations discover backups are corrupted or incomplete only when they need them most.',
    service: 'Cloud & Backup',
    clientField: null,
  },
  {
    key: 'offsite_backup',
    pillar: 'continuity',
    question: 'Does at least one backup copy exist offsite or in the cloud (3-2-1 rule)?',
    hint: '3 copies of data, on 2 different media, with 1 stored offsite.',
    yesImpact: 0.75, noImpact: -0.5,
    priority: 'high',
    recommendation: 'Implement the 3-2-1 backup strategy. On-site-only backups are destroyed by the same ransomware, fire, or flood that took down the primary systems.',
    service: 'Cloud & Backup',
    clientField: null,
  },
  {
    key: 'data_classified',
    pillar: 'continuity',
    question: 'Is business data classified by sensitivity (e.g., public, internal, confidential)?',
    hint: 'Classification drives proportionate protection and access decisions.',
    yesImpact: 0.5, noImpact: -0.25,
    priority: 'medium',
    recommendation: 'Adopt a 3-tier data classification policy. Knowing what data you have and its sensitivity is the prerequisite for all proportionate protection decisions.',
    service: 'Cybersecurity',
    clientField: null,
  },
  {
    key: 'dr_plan',
    pillar: 'continuity',
    question: 'Does a documented disaster recovery plan exist?',
    hint: 'A written plan specifying how to restore operations after a major incident.',
    yesImpact: 0.75, noImpact: -0.5,
    priority: 'high',
    recommendation: 'Develop a disaster recovery plan that defines Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO) for every critical system.',
    service: 'Managed IT',
    clientField: null,
  },
  {
    key: 'recovery_time',
    pillar: 'continuity',
    question: 'Do you know how long it would take to restore full operations after a major incident?',
    hint: 'Your Recovery Time Objective (RTO) drives your investment in resilience.',
    yesImpact: 0.5, noImpact: -0.25,
    priority: 'medium',
    recommendation: 'Define your RTO and RPO. Most small businesses are surprised to find recovery would take days or weeks without advance planning.',
    service: 'Managed IT',
    clientField: null,
  },

  // ── Pillar 3: Operational Resilience ─────────────────────────────────────
  {
    key: 'antivirus_edr',
    pillar: 'resilience',
    question: 'Is antivirus or EDR (Endpoint Detection & Response) deployed on all devices?',
    hint: 'EDR is the modern standard — significantly more effective than traditional antivirus.',
    yesImpact: 1.5, noImpact: -1.5,
    priority: 'critical',
    recommendation: 'Deploy a managed EDR solution on all endpoints. Traditional antivirus misses modern threats — fileless malware, ransomware, and living-off-the-land attacks.',
    service: 'Cybersecurity',
    clientField: 'uses_antivirus',
  },
  {
    key: 'firewall',
    pillar: 'resilience',
    question: 'Is a business-grade firewall actively protecting your network perimeter?',
    hint: 'A properly configured firewall with IDS/IPS blocks unauthorized traffic.',
    yesImpact: 1.0, noImpact: -1.0,
    priority: 'critical',
    recommendation: 'Install and configure a managed business-grade firewall. A consumer router is not a firewall — the difference is significant for perimeter defense.',
    service: 'Managed IT',
    clientField: 'uses_firewall',
  },
  {
    key: 'patch_management',
    pillar: 'resilience',
    question: 'Is automated patch management in place for all operating systems and software?',
    hint: 'Unpatched systems are the primary entry vector for ransomware.',
    yesImpact: 1.5, noImpact: -1.5,
    priority: 'critical',
    recommendation: 'Implement automated patch management immediately. Over 60% of breaches exploit known vulnerabilities for which patches existed but were not applied.',
    service: 'Managed IT',
    clientField: null,
  },
  {
    key: 'security_training',
    pillar: 'resilience',
    question: 'Do all employees receive regular security awareness training?',
    hint: 'Phishing simulations and threat awareness — at minimum annually.',
    yesImpact: 1.0, noImpact: -0.5,
    priority: 'high',
    recommendation: 'Enroll staff in security awareness training with quarterly phishing simulations. Human error causes 85%+ of successful breaches — training is your highest-ROI control.',
    service: 'Cybersecurity',
    clientField: null,
  },
  {
    key: 'incident_response',
    pillar: 'resilience',
    question: 'Does a written incident response plan exist that your staff know how to follow?',
    hint: 'A runbook: who to call, what to shut down, how to preserve evidence.',
    yesImpact: 0.75, noImpact: -0.5,
    priority: 'high',
    recommendation: 'Create a simple incident response runbook. Having clear steps ready reduces breach response time from days to hours and limits total data exposure.',
    service: 'Cybersecurity',
    clientField: null,
  },
  {
    key: 'vpn_remote',
    pillar: 'resilience',
    question: 'Are VPN or Zero Trust access controls in place for all remote workers?',
    hint: 'Remote access without VPN exposes your internal network directly to the internet.',
    yesImpact: 0.5, noImpact: -0.75,
    priority: 'high',
    recommendation: 'Deploy a business VPN or Zero Trust Network Access (ZTNA) solution. Unprotected remote access is a primary ransomware entry point for small businesses.',
    service: 'Managed IT',
    clientField: 'uses_vpn',
  },
];

function calculatePillarScore(pillarKey, answers) {
  const checks = CHECKS.filter(c => c.pillar === pillarKey);
  let score = 5.0;
  for (const check of checks) {
    const answer = answers[check.key];
    if (answer === 'yes' || answer === 1 || answer === true) {
      score += check.yesImpact;
    } else if (answer === 'no' || answer === 0 || answer === false) {
      score += check.noImpact;
    }
  }
  return Math.max(0, Math.min(10, parseFloat(score.toFixed(1))));
}

function calculateORI(answers) {
  const identity = calculatePillarScore('identity', answers);
  const continuity = calculatePillarScore('continuity', answers);
  const resilience = calculatePillarScore('resilience', answers);
  const overall = parseFloat(((identity + continuity + resilience) / 3).toFixed(1));
  return { overall, identity, continuity, resilience };
}

function getScoreLevel(score) {
  if (score >= 8) return { label: 'Optimal', cssClass: 'score-optimal', color: '#10b981' };
  if (score >= 6) return { label: 'Acceptable', cssClass: 'score-acceptable', color: '#f59e0b' };
  if (score >= 4) return { label: 'Caution', cssClass: 'score-caution', color: '#f97316' };
  return { label: 'Critical', cssClass: 'score-critical', color: '#dc2626' };
}

function generateRemediation(answers) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  const items = [];
  for (const check of CHECKS) {
    const answer = answers[check.key];
    const isNo = answer === 'no' || answer === 0 || answer === false;
    const isMissing = (answer === null || answer === undefined) && check.priority === 'critical';
    if (isNo || isMissing) {
      items.push({
        key: check.key,
        pillar: check.pillar,
        pillarLabel: PILLARS[check.pillar].label,
        priority: check.priority,
        question: check.question,
        recommendation: check.recommendation,
        service: check.service,
      });
    }
  }
  return items.sort((a, b) => order[a.priority] - order[b.priority]);
}

// Map existing onboarding fields to ORI check answers
function prefillFromClient(client) {
  const answers = {};
  if (!client) return answers;
  const map = {
    uses_cloud_backup: 'backup_exists',
    uses_antivirus: 'antivirus_edr',
    uses_firewall: 'firewall',
    uses_vpn: 'vpn_remote',
  };
  for (const [field, checkKey] of Object.entries(map)) {
    if (client[field] !== null && client[field] !== undefined) {
      answers[checkKey] = client[field] ? 'yes' : 'no';
    }
  }
  return answers;
}

module.exports = { PILLARS, CHECKS, calculateORI, getScoreLevel, generateRemediation, prefillFromClient };
