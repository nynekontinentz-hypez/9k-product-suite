/**
 * Auth middleware + route integration tests.
 * Tests session guards, login flows, and redirect behaviour.
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDb, seedDemoData } = require('./helpers');

describe('Auth middleware', () => {
  before(async () => {
    setupTestDb();
    await seedDemoData();
  });

  // ── requireClient ─────────────────────────────────────────────────────────

  describe('requireClient', () => {
    it('redirects to /login when no session', () => {
      const { requireClient } = require('../middleware/auth');
      let redirected = null;
      const req = { session: {}, originalUrl: '/client/tickets' };
      const res = { redirect: (url) => { redirected = url; } };
      const next = () => { throw new Error('should not call next'); };

      requireClient(req, res, next);
      assert.equal(redirected, '/login');
      assert.equal(req.session.returnTo, '/client/tickets');
    });

    it('calls next() when client session exists', () => {
      const { requireClient } = require('../middleware/auth');
      let called = false;
      const req = { session: { client: { id: 1 } } };
      const res = {};
      const next = () => { called = true; };

      requireClient(req, res, next);
      assert.ok(called);
    });
  });

  // ── requireAdmin ──────────────────────────────────────────────────────────

  describe('requireAdmin', () => {
    it('redirects to /admin/login when no session', () => {
      const { requireAdmin } = require('../middleware/auth');
      let redirected = null;
      const req = { session: {}, originalUrl: '/admin/clients' };
      const res = { redirect: (url) => { redirected = url; } };
      const next = () => { throw new Error('should not call next'); };

      requireAdmin(req, res, next);
      assert.equal(redirected, '/admin/login');
      assert.equal(req.session.returnTo, '/admin/clients');
    });

    it('calls next() when admin session exists', () => {
      const { requireAdmin } = require('../middleware/auth');
      let called = false;
      const req = { session: { admin: { id: 1, role: 'admin' } } };
      const res = {};
      const next = () => { called = true; };

      requireAdmin(req, res, next);
      assert.ok(called);
    });
  });

  // ── requireRole ───────────────────────────────────────────────────────────

  describe('requireRole', () => {
    it('allows admin role to access any required role', () => {
      const { requireRole } = require('../middleware/auth');
      let called = false;
      const middleware = requireRole('technician');
      const req = { session: { admin: { id: 1, role: 'admin' } } };
      const res = {};
      const next = () => { called = true; };

      middleware(req, res, next);
      assert.ok(called);
    });

    it('allows matching role', () => {
      const { requireRole } = require('../middleware/auth');
      let called = false;
      const middleware = requireRole('technician');
      const req = { session: { admin: { id: 2, role: 'technician' } } };
      const res = {};
      const next = () => { called = true; };

      middleware(req, res, next);
      assert.ok(called);
    });

    it('rejects mismatched role with 403', () => {
      const { requireRole } = require('../middleware/auth');
      let statusCode = null;
      let rendered = null;
      const middleware = requireRole('admin');
      const req = { session: { admin: { id: 2, role: 'technician' } } };
      const res = {
        status: (code) => { statusCode = code; return res; },
        render: (view, data) => { rendered = { view, data }; },
      };
      const next = () => { throw new Error('should not call next'); };

      middleware(req, res, next);
      assert.equal(statusCode, 403);
      assert.equal(rendered.view, 'error');
    });

    it('redirects to login when no admin session at all', () => {
      const { requireRole } = require('../middleware/auth');
      let redirected = null;
      const middleware = requireRole('admin');
      const req = { session: {} };
      const res = { redirect: (url) => { redirected = url; } };
      const next = () => { throw new Error('should not call next'); };

      middleware(req, res, next);
      assert.equal(redirected, '/admin/login');
    });
  });

  // ── Password verification (bcrypt) ────────────────────────────────────────

  describe('password verification', () => {
    it('bcrypt.compare returns true for correct password', async () => {
      const bcrypt = require('bcryptjs');
      const clients = require('../db/clients');
      const client = await clients.findByEmail('jamie@acmecorp.com');
      assert.ok(client);
      const match = await bcrypt.compare('portal1234', client.password_hash);
      assert.ok(match);
    });

    it('bcrypt.compare returns false for wrong password', async () => {
      const bcrypt = require('bcryptjs');
      const clients = require('../db/clients');
      const client = await clients.findByEmail('jamie@acmecorp.com');
      const match = await bcrypt.compare('wrong-password', client.password_hash);
      assert.ok(!match);
    });

    it('admin password verification works', async () => {
      const bcrypt = require('bcryptjs');
      const admins = require('../db/admin-users');
      const admin = await admins.findByEmail('admin@9ksystems.net');
      assert.ok(admin);
      const match = await bcrypt.compare('admin-pass', admin.password_hash);
      assert.ok(match);
    });
  });
});
