const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const clients = require('../db/clients');
const admins = require('../db/admin-users');
const audit = require('../middleware/audit');
const { query } = require('../db');

// Only allow redirecting to local paths — prevents open-redirect
function safeReturnTo(url) {
  if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) return url;
  return null;
}

// ── Client auth ──────────────────────────────────────────────────────────────

router.get('/login', (req, res) => {
  if (req.session?.client) return res.redirect('/client');
  res.render('login', { error: null, type: 'client', query: req.query });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.render('login', { error: 'Email and password are required.', type: 'client', query: {} });
  }
  const client = await clients.findByEmail(email.trim().toLowerCase());
  if (!client || !client.password_hash) {
    return res.render('login', { error: 'Invalid credentials.', type: 'client', query: {} });
  }
  const match = await bcrypt.compare(password, client.password_hash);
  if (!match) {
    await audit.log('client', client.id, 'login_failed', null, null, { email }, req.ip);
    return res.render('login', { error: 'Invalid credentials.', type: 'client', query: {} });
  }
  req.session.client = { id: client.id, company_name: client.company_name, email: client.primary_contact_email, name: client.primary_contact_name };
  await clients.updateLastLogin(client.id);
  await audit.log('client', client.id, 'login', null, null, null, req.ip);
  const returnTo = safeReturnTo(req.session.returnTo) || '/client';
  delete req.session.returnTo;
  res.redirect(returnTo);
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ── Invite / set-password ────────────────────────────────────────────────────

router.get('/invite/:token', async (req, res) => {
  const row = await query(
    `SELECT ca.*, c.primary_contact_name FROM client_auth ca JOIN clients c ON ca.client_id = c.id WHERE ca.invite_token = ? AND ca.invite_expires_at > datetime('now')`,
    [req.params.token]
  );
  if (!row[0]) return res.render('error', { message: 'This invite link is invalid or has expired.', status: 400, user: null });
  res.render('set-password', { token: req.params.token, name: row[0].primary_contact_name, error: null });
});

router.post('/invite/:token', async (req, res) => {
  const { password, confirm } = req.body;
  const row = await query(
    `SELECT ca.*, c.primary_contact_name FROM client_auth ca JOIN clients c ON ca.client_id = c.id WHERE ca.invite_token = ? AND ca.invite_expires_at > datetime('now')`,
    [req.params.token]
  );
  if (!row[0]) return res.render('error', { message: 'Invite expired.', status: 400, user: null });
  if (!password || password.length < 8) {
    return res.render('set-password', { token: req.params.token, name: row[0].primary_contact_name, error: 'Password must be at least 8 characters.' });
  }
  if (password !== confirm) {
    return res.render('set-password', { token: req.params.token, name: row[0].primary_contact_name, error: 'Passwords do not match.' });
  }
  const hash = await bcrypt.hash(password, 12);
  await query(`UPDATE client_auth SET password_hash = ?, invite_token = NULL, invite_expires_at = NULL WHERE id = ?`, [hash, row[0].id]);
  res.redirect('/login?activated=1');
});

// ── Admin auth ───────────────────────────────────────────────────────────────

router.get('/admin/login', (req, res) => {
  if (req.session?.admin) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  const admin = await admins.findByEmail(email?.trim().toLowerCase());
  if (!admin) return res.render('admin/login', { error: 'Invalid credentials.' });
  const match = await bcrypt.compare(password, admin.password_hash);
  if (!match) {
    await audit.log('admin', admin.id, 'login_failed', null, null, { email }, req.ip);
    return res.render('admin/login', { error: 'Invalid credentials.' });
  }
  req.session.admin = { id: admin.id, name: admin.name, email: admin.email, role: admin.role };
  await admins.updateLastLogin(admin.id);
  await audit.log('admin', admin.id, 'login', null, null, null, req.ip);
  const returnTo = safeReturnTo(req.session.returnTo) || '/admin';
  delete req.session.returnTo;
  res.redirect(returnTo);
});

router.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

module.exports = router;
