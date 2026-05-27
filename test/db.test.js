/**
 * DB layer regression tests — covers clients, tickets, admin-users, contracts.
 * Uses node:test (built-in) with an in-memory SQLite database.
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDb, seedDemoData } = require('./helpers');

describe('DB layer', () => {
  before(async () => {
    setupTestDb();
    await seedDemoData();
  });

  // ── clients.js ──────────────────────────────────────────────────────────────

  describe('clients', () => {
    it('findAll returns all clients with tier info', async () => {
      const clients = require('../db/clients');
      const all = await clients.findAll();
      assert.ok(all.length >= 1);
      assert.equal(all[0].company_name, 'Acme Corp');
      assert.equal(all[0].tier_name, 'Professional');
    });

    it('findById returns client with tier join', async () => {
      const clients = require('../db/clients');
      const c = await clients.findById(1);
      assert.ok(c);
      assert.equal(c.company_name, 'Acme Corp');
      assert.equal(c.tier_price, 599);
      assert.equal(c.primary_contact_email, 'jamie@acmecorp.com');
    });

    it('findById returns null for non-existent id', async () => {
      const clients = require('../db/clients');
      const c = await clients.findById(999);
      assert.equal(c, null);
    });

    it('findByEmail returns client with auth fields', async () => {
      const clients = require('../db/clients');
      const c = await clients.findByEmail('jamie@acmecorp.com');
      assert.ok(c);
      assert.ok(c.password_hash);
      assert.equal(c.company_name, 'Acme Corp');
    });

    it('findByEmail returns null for unknown email', async () => {
      const clients = require('../db/clients');
      const c = await clients.findByEmail('nobody@example.com');
      assert.equal(c, null);
    });

    it('create inserts a new client and returns its id', async () => {
      const clients = require('../db/clients');
      const id = await clients.create({
        company_name: 'Test Corp',
        primary_contact_name: 'Test User',
        primary_contact_email: 'test@testcorp.com',
      });
      assert.ok(id > 0);
      const created = await clients.findById(id);
      assert.equal(created.company_name, 'Test Corp');
      assert.equal(created.environment, 'hybrid'); // default
    });

    it('updateLastLogin does not throw', async () => {
      const clients = require('../db/clients');
      await clients.updateLastLogin(1); // should not throw
    });
  });

  // ── admin-users.js ──────────────────────────────────────────────────────────

  describe('admin-users', () => {
    it('findByEmail returns active admin', async () => {
      const admins = require('../db/admin-users');
      const a = await admins.findByEmail('admin@9ksystems.net');
      assert.ok(a);
      assert.equal(a.role, 'admin');
      assert.ok(a.password_hash);
    });

    it('findByEmail returns null for unknown email', async () => {
      const admins = require('../db/admin-users');
      const a = await admins.findByEmail('nobody@9ksystems.net');
      assert.equal(a, null);
    });

    it('findById returns admin by id', async () => {
      const admins = require('../db/admin-users');
      const a = await admins.findById(1);
      assert.ok(a);
      assert.equal(a.name, '9K Admin');
    });

    it('findAll returns admins without password hashes', async () => {
      const admins = require('../db/admin-users');
      const all = await admins.findAll();
      assert.ok(all.length >= 1);
      // findAll explicitly selects columns — no password_hash
      assert.equal(all[0].password_hash, undefined);
    });
  });

  // ── tickets.js ──────────────────────────────────────────────────────────────

  describe('tickets', () => {
    it('findAll returns tickets ordered by urgency', async () => {
      const tickets = require('../db/tickets');
      const all = await tickets.findAll();
      assert.ok(all.length >= 2);
      // critical should sort first
      assert.equal(all[0].urgency, 'critical');
    });

    it('findAll supports status filter', async () => {
      const tickets = require('../db/tickets');
      const open = await tickets.findAll({ status: 'open' });
      assert.ok(open.every(t => t.status === 'open'));
    });

    it('findById returns ticket with client join', async () => {
      const tickets = require('../db/tickets');
      const t = await tickets.findById(1);
      assert.ok(t);
      assert.equal(t.title, 'Outlook not connecting');
      assert.equal(t.company_name, 'Acme Corp');
    });

    it('findByClient returns only that client\'s tickets', async () => {
      const tickets = require('../db/tickets');
      const ct = await tickets.findByClient(1);
      assert.ok(ct.length >= 2);
      assert.ok(ct.every(t => t.client_id === 1));
    });

    it('getUpdates excludes internal notes by default', async () => {
      const tickets = require('../db/tickets');
      const updates = await tickets.getUpdates(1, false);
      assert.ok(updates.length >= 1);
      assert.ok(updates.every(u => u.internal === 0));
    });

    it('getUpdates includes internal notes when requested', async () => {
      const tickets = require('../db/tickets');
      const updates = await tickets.getUpdates(1, true);
      assert.ok(updates.some(u => u.internal === 1));
    });

    it('updateStatus changes ticket status', async () => {
      const tickets = require('../db/tickets');
      await tickets.updateStatus(2, 'in_progress', 1);
      const t = await tickets.findById(2);
      assert.equal(t.status, 'in_progress');
    });

    it('stats returns aggregate counts', async () => {
      const tickets = require('../db/tickets');
      const s = await tickets.stats();
      assert.ok(s.total >= 2);
      assert.ok(typeof s.open === 'number');
      assert.ok(typeof s.in_progress === 'number');
    });
  });

  // ── contracts.js ──────────────────────────────────────────────────────────

  describe('contracts', () => {
    it('findActive returns active contract for client', async () => {
      const contracts = require('../db/contracts');
      const c = await contracts.findActive(1);
      assert.ok(c);
      assert.equal(c.status, 'active');
      assert.equal(c.monthly_rate, 599);
    });

    it('findActive returns null for client with no contract', async () => {
      const contracts = require('../db/contracts');
      const c = await contracts.findActive(999);
      assert.equal(c, null);
    });
  });
});
