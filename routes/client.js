const express = require('express');
const router = express.Router();
const { requireClient } = require('../middleware/auth');
const clients = require('../db/clients');
const tickets = require('../db/tickets');
const contracts = require('../db/contracts');
const mailer = require('../lib/mailer');
const audit = require('../middleware/audit');
const oriDb = require('../db/ori');
const { calculateORI, getScoreLevel, generateRemediation, prefillFromClient, CHECKS, PILLARS } = require('../lib/ori-engine');

router.use(requireClient);

// ── Dashboard ────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const [client, clientTickets, contract, oriLatest] = await Promise.all([
    clients.findById(req.session.client.id),
    tickets.findByClient(req.session.client.id),
    contracts.findActive(req.session.client.id),
    oriDb.getLatestAssessment(req.session.client.id),
  ]);
  const open = clientTickets.filter(t => t.status === 'open' || t.status === 'in_progress');
  res.render('client/dashboard', {
    user: req.session.client, client, tickets: clientTickets.slice(0, 5),
    openCount: open.length, contract, oriLatest, oriGetLevel: getScoreLevel,
  });
});

// ── Tickets ──────────────────────────────────────────────────────────────────

router.get('/tickets', async (req, res) => {
  const all = await tickets.findByClient(req.session.client.id);
  res.render('client/tickets', { user: req.session.client, tickets: all });
});

router.get('/tickets/new', (req, res) => {
  res.render('client/new-ticket', { user: req.session.client, error: null });
});

router.post('/tickets/new', async (req, res) => {
  const { title, description, category, urgency, affected_asset } = req.body;
  if (!title || !description) {
    return res.render('client/new-ticket', { user: req.session.client, error: 'Title and description are required.' });
  }
  const client = await clients.findById(req.session.client.id);
  const id = await tickets.create({
    client_id: req.session.client.id,
    title, description, category, urgency: urgency || 'normal',
    affected_asset,
    client_env_tag: client.environment || 'unknown',
  });
  const ticket = await tickets.findById(id);
  await mailer.sendTicketConfirmation(req.session.client.email, ticket).catch(() => {});
  await audit.log('client', req.session.client.id, 'ticket_created', 'ticket', id, { title }, req.ip);
  res.redirect(`/client/tickets/${id}?created=1`);
});

router.get('/tickets/:id', async (req, res) => {
  const ticket = await tickets.findById(req.params.id);
  if (!ticket || ticket.client_id !== req.session.client.id) {
    return res.status(404).render('error', { message: 'Ticket not found.', status: 404, user: req.session.client });
  }
  const updates = await tickets.getUpdates(req.params.id, false);
  res.render('client/ticket-detail', {
    user: req.session.client, ticket, updates,
    created: req.query.created === '1',
  });
});

// ── ORI: Operational Resilience Index ────────────────────────────────────────

router.get('/ori', async (req, res) => {
  const [client, latest, history] = await Promise.all([
    clients.findById(req.session.client.id),
    oriDb.getLatestAssessment(req.session.client.id),
    oriDb.getAssessmentHistory(req.session.client.id),
  ]);
  let remediation = [];
  if (latest) {
    const resp = JSON.parse(latest.responses);
    remediation = generateRemediation(resp).slice(0, 3);
  }
  res.render('client/ori-hub', {
    user: req.session.client, client, latest, history, remediation, getScoreLevel,
  });
});

router.get('/ori/assessment', async (req, res) => {
  const client = await clients.findById(req.session.client.id);
  const prefilled = prefillFromClient(client);
  res.render('client/ori-assessment', {
    user: req.session.client,
    prefilled: JSON.stringify(prefilled),
    checks: CHECKS,
    pillars: PILLARS,
  });
});

router.post('/ori/assessment', async (req, res) => {
  const responses = {};
  for (const check of CHECKS) {
    const val = req.body[check.key];
    if (val === 'yes' || val === 'no') responses[check.key] = val;
  }
  const scores = calculateORI(responses);
  const id = await oriDb.saveAssessment(req.session.client.id, responses, scores);
  await audit.log('client', req.session.client.id, 'ori_assessment', 'ori_assessment', id, { score: scores.overall }, req.ip);
  res.redirect(`/client/ori/results/${id}`);
});

router.get('/ori/results/:id', async (req, res) => {
  const assessment = await oriDb.getAssessmentById(req.params.id, req.session.client.id);
  if (!assessment) {
    return res.status(404).render('error', { message: 'Assessment not found.', status: 404, user: req.session.client });
  }
  const responses = JSON.parse(assessment.responses);
  const remediation = generateRemediation(responses);
  res.render('client/ori-results', {
    user: req.session.client, assessment, responses, remediation,
    checks: CHECKS, pillars: PILLARS, getScoreLevel,
  });
});

// ── Onboarding intake form ────────────────────────────────────────────────────

router.get('/onboarding', async (req, res) => {
  const client = await clients.findById(req.session.client.id);
  res.render('client/onboarding', { user: req.session.client, client, success: false, error: null });
});

router.post('/onboarding', async (req, res) => {
  const {
    industry, primary_contact_role, city, website, address, business_age,
    os_windows, os_mac, os_chrome, os_mixed,
    uses_microsoft_365, uses_google_workspace, uses_azure_ad, uses_cloud_backup,
    uses_antivirus, uses_firewall, uses_vpn, uses_remote_work, uses_onsite_server,
    pain_point,
    interest_managed_it, interest_cybersecurity, interest_cloud, interest_m365,
    interest_backup, interest_compliance, interest_vcio, interest_training,
    budget_range, timeline,
    compliance_hipaa, compliance_pci, compliance_soc2,
    emergency_contact_name, emergency_contact_phone,
    referral_source, previous_msp_experience
  } = req.body;

  const endpoint_count = parseInt(req.body.endpoint_count) || 0;

  await require('../db').query(
    `UPDATE clients SET
      industry = ?, primary_contact_role = ?, city = ?, website = ?, address = ?, business_age = ?,
      endpoint_count = ?,
      os_windows = ?, os_mac = ?, os_chrome = ?, os_mixed = ?,
      uses_microsoft_365 = ?, uses_google_workspace = ?, uses_azure_ad = ?, uses_cloud_backup = ?,
      uses_antivirus = ?, uses_firewall = ?, uses_vpn = ?, uses_remote_work = ?, uses_onsite_server = ?,
      pain_point = ?,
      interest_managed_it = ?, interest_cybersecurity = ?, interest_cloud = ?, interest_m365 = ?,
      interest_backup = ?, interest_compliance = ?, interest_vcio = ?, interest_training = ?,
      budget_range = ?, timeline = ?,
      compliance_hipaa = ?, compliance_pci = ?, compliance_soc2 = ?,
      emergency_contact_name = ?, emergency_contact_phone = ?,
      referral_source = ?, previous_msp_experience = ?
    WHERE id = ?`,
    [
      industry || null, primary_contact_role || null, city || null, website || null, address || null, business_age || null,
      endpoint_count,
      os_windows ? 1 : 0, os_mac ? 1 : 0, os_chrome ? 1 : 0, os_mixed ? 1 : 0,
      uses_microsoft_365 ? 1 : 0, uses_google_workspace ? 1 : 0, uses_azure_ad ? 1 : 0, uses_cloud_backup ? 1 : 0,
      uses_antivirus ? 1 : 0, uses_firewall ? 1 : 0, uses_vpn ? 1 : 0, uses_remote_work ? 1 : 0, uses_onsite_server ? 1 : 0,
      pain_point || null,
      interest_managed_it ? 1 : 0, interest_cybersecurity ? 1 : 0, interest_cloud ? 1 : 0, interest_m365 ? 1 : 0,
      interest_backup ? 1 : 0, interest_compliance ? 1 : 0, interest_vcio ? 1 : 0, interest_training ? 1 : 0,
      budget_range || 'unsure', timeline || 'exploring',
      compliance_hipaa ? 1 : 0, compliance_pci ? 1 : 0, compliance_soc2 ? 1 : 0,
      emergency_contact_name || null, emergency_contact_phone || null,
      referral_source || null, previous_msp_experience || null,
      req.session.client.id
    ]
  );

  const client = await clients.findById(req.session.client.id);
  res.render('client/onboarding', { user: req.session.client, client, success: true, error: null });
});

module.exports = router;
