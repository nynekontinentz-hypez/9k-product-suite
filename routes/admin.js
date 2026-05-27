const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const clients = require('../db/clients');
const tickets = require('../db/tickets');
const contracts = require('../db/contracts');
const tiers = require('../db/tiers');
const stats = require('../db/stats');
const mailer = require('../lib/mailer');
const audit = require('../middleware/audit');

router.use(requireAdmin);

// ── Dashboard ────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const [overview, allClients, activeTickets] = await Promise.all([
    stats.overview(),
    clients.findAll(),
    // Show both open and in_progress so nothing is invisible on the dashboard
    tickets.findAll(),
  ]);
  const actionable = activeTickets.filter(t => t.status === 'open' || t.status === 'in_progress');
  res.render('admin/dashboard', {
    user: req.session.admin, overview, clients: allClients,
    tickets: actionable.slice(0, 10),
  });
});

// ── Clients ──────────────────────────────────────────────────────────────────

router.get('/clients', async (req, res) => {
  const all = await clients.findAll();
  res.render('admin/clients', { user: req.session.admin, clients: all });
});

router.get('/clients/new', async (req, res) => {
  const serviceTiers = await tiers.findAllService();
  res.render('admin/client-form', { user: req.session.admin, client: null, serviceTiers, error: null });
});

router.post('/clients/new', async (req, res) => {
  const { company_name, primary_contact_name, primary_contact_email, phone, service_tier_id, monthly_rate } = req.body;
  if (!company_name || !primary_contact_name || !primary_contact_email) {
    const serviceTiers = await tiers.findAllService();
    return res.render('admin/client-form', { user: req.session.admin, client: null, serviceTiers, error: 'Required fields missing.' });
  }
  const clientId = await clients.create({ company_name, primary_contact_name, primary_contact_email: primary_contact_email.toLowerCase(), phone, service_tier_id });
  const token = crypto.randomBytes(32).toString('hex');
  const tempHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 12);
  await clients.setAuth(clientId, tempHash, token);

  if (monthly_rate && service_tier_id) {
    await contracts.create({ client_id: clientId, service_tier_id, start_date: new Date().toISOString().split('T')[0], monthly_rate });
  }

  await mailer.sendClientInvite(primary_contact_email, primary_contact_name, token).catch(() => {});
  await audit.log('admin', req.session.admin.id, 'client_created', 'client', clientId, { company_name }, req.ip);
  res.redirect(`/admin/clients/${clientId}?created=1`);
});

const playbooks = require('../db/playbooks');

router.get('/clients/:id', async (req, res) => {
  const [client, clientTickets, clientContracts] = await Promise.all([
    clients.findById(req.params.id),
    tickets.findByClient(req.params.id),
    contracts.findByClient(req.params.id),
  ]);
  if (!client) return res.status(404).render('error', { message: 'Client not found.', status: 404, user: req.session.admin });
  
  const matchingPlaybook = playbooks.findByIndustry(client.industry);

  res.render('admin/client-detail', {
    user: req.session.admin, client, tickets: clientTickets, contracts: clientContracts,
    created: req.query.created === '1',
    playbook: matchingPlaybook
  });
});

// ── Tickets ──────────────────────────────────────────────────────────────────

router.get('/tickets', async (req, res) => {
  const { status } = req.query;
  const all = await tickets.findAll(status ? { status } : {});
  res.render('admin/tickets', { user: req.session.admin, tickets: all, filter: status || 'all' });
});

router.get('/tickets/:id', async (req, res) => {
  const [ticket, updates] = await Promise.all([
    tickets.findById(req.params.id),
    tickets.getUpdates(req.params.id, true),
  ]);
  if (!ticket) return res.status(404).render('error', { message: 'Ticket not found.', status: 404, user: req.session.admin });
  res.render('admin/ticket-detail', { user: req.session.admin, ticket, updates });
});

// HTMX: update ticket status
const VALID_STATUSES = { open: 'Open', in_progress: 'In Progress', on_hold: 'On Hold', closed: 'Closed' };
const STATUS_COLORS  = { open: 'badge-open', in_progress: 'badge-in-progress', on_hold: 'badge-on-hold', closed: 'badge-closed' };

router.post('/tickets/:id/status', async (req, res) => {
  const { status, note, client_summary } = req.body;

  // Whitelist status — never reflect unsanitised input
  if (!VALID_STATUSES[status]) return res.status(400).send('Invalid status');

  const ticket = await tickets.findById(req.params.id);
  if (!ticket) return res.status(404).send('Not found');

  // Warn if closing without client summary
  if (status === 'closed' && !client_summary && !note) {
    return res.status(400).send('Please add a client summary or internal note before closing.');
  }

  await tickets.updateStatus(req.params.id, status, req.session.admin.id);

  if (note) {
    await tickets.addUpdate(req.params.id, 'admin', req.session.admin.id, note, true);
  }
  if (client_summary) {
    await tickets.addUpdate(req.params.id, 'admin', req.session.admin.id, client_summary, false);
    const client = await clients.findById(ticket.client_id);
    if (client) await mailer.sendTicketUpdate(client.primary_contact_email, ticket, client_summary).catch(() => {});
  }

  await audit.log('admin', req.session.admin.id, 'ticket_status_updated', 'ticket', req.params.id,
    { from: ticket.status, to: status }, req.ip);

  // HTMX: swap status badge + append new timeline entries
  const updatedUpdates = await tickets.getUpdates(req.params.id, true);
  const newEntries = updatedUpdates.slice(-((note ? 1 : 0) + (client_summary ? 1 : 0)));
  const timelineHtml = newEntries.map(u => `
    <div class="timeline-item" id="update-${u.id}">
      <div class="timeline-dot admin"></div>
      <div class="timeline-content">
        <div class="timeline-meta">
          ${u.admin_name || 'Admin'} · ${new Date(u.created_at).toLocaleString()}
          ${u.internal ? '<span class="badge badge-on-hold" style="margin-left:6px;font-size:.65rem">internal</span>' : ''}
        </div>
        <div class="${u.internal ? 'timeline-internal' : 'timeline-body'}">${u.content}</div>
      </div>
    </div>`).join('');

  res.send(`
    <span class="badge ${STATUS_COLORS[status]}" id="status-badge">${VALID_STATUSES[status]}</span>
    <div id="timeline-updates" hx-swap-oob="beforeend:#ticket-timeline">${timelineHtml}</div>
    <div id="update-toast" hx-swap-oob="innerHTML:#update-toast">
      <div class="alert alert-success" style="margin-top:12px">Updated — ${client_summary ? 'client notified by email.' : 'internal note saved.'}</div>
    </div>
  `);
});

module.exports = router;
