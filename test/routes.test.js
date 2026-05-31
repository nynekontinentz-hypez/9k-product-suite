/**
 * Route integration tests — exercises HTTP endpoints via supertest-like
 * approach using Node's built-in http module against the Express app.
 *
 * Tests cover: login flows, protected route guards, and page rendering.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { setupTestDb, seedDemoData } = require('./helpers');

let server;
let baseUrl;

/** Make an HTTP request and return { status, headers, body }. */
function request(method, path, { body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {},
    };
    if (cookie) opts.headers.cookie = cookie;

    let payload;
    if (body) {
      payload = new URLSearchParams(body).toString();
      opts.headers['content-type'] = 'application/x-www-form-urlencoded';
      opts.headers['content-length'] = Buffer.byteLength(payload);
    }

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Extract Set-Cookie header value for subsequent requests. */
function getCookie(res) {
  const raw = res.headers['set-cookie'];
  if (!raw) return null;
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map(c => c.split(';')[0]).join('; ');
}

describe('Route integration', () => {
  before(async () => {
    setupTestDb();
    await seedDemoData();

    // Clear cached server + route modules so they pick up the test DB
    for (const key of Object.keys(require.cache)) {
      if (key.includes('server.js') || key.includes('routes') || key.includes('middleware')) {
        delete require.cache[key];
      }
    }

    // Require app (server.js exports app, doesn't auto-listen in test)
    delete require.cache[require.resolve('../server')];
    const app = require('../server');

    // Start on a random port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(() => {
    if (server) server.close();
  });

  // ── Public routes ─────────────────────────────────────────────────────────

  describe('public routes', () => {
    it('GET /login returns 200', async () => {
      const res = await request('GET', '/login');
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('Client Portal'));
    });

    it('GET /admin/login returns 200', async () => {
      const res = await request('GET', '/admin/login');
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('Admin'));
    });

    it('GET /nonexistent returns 404', async () => {
      const res = await request('GET', '/nonexistent');
      assert.equal(res.status, 404);
    });
  });

  // ── Client auth flow ──────────────────────────────────────────────────────

  describe('client login', () => {
    it('POST /login with valid creds redirects to /client', async () => {
      const res = await request('POST', '/login', {
        body: { email: 'jamie@acmecorp.com', password: 'portal1234' },
      });
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, '/client');
      assert.ok(getCookie(res));
    });

    it('POST /login with wrong password re-renders login with error', async () => {
      const res = await request('POST', '/login', {
        body: { email: 'jamie@acmecorp.com', password: 'wrongpass' },
      });
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('Invalid credentials'));
    });

    it('POST /login with missing fields re-renders login with error', async () => {
      const res = await request('POST', '/login', {
        body: { email: '', password: '' },
      });
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('required'));
    });
  });

  // ── Protected client routes ───────────────────────────────────────────────

  describe('protected client routes', () => {
    let cookie;

    before(async () => {
      const res = await request('POST', '/login', {
        body: { email: 'jamie@acmecorp.com', password: 'portal1234' },
      });
      cookie = getCookie(res);
    });

    it('GET /client without session redirects to /login', async () => {
      const res = await request('GET', '/client');
      assert.equal(res.status, 302);
      assert.ok(res.headers.location.includes('/login'));
    });

    it('GET /client with session returns 200 dashboard', async () => {
      const res = await request('GET', '/client', { cookie });
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('Dashboard'));
      assert.ok(res.body.includes('Acme Corp') || res.body.includes('Professional'));
    });

    it('GET /client/tickets with session returns 200', async () => {
      const res = await request('GET', '/client/tickets', { cookie });
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('Outlook'));
    });

    it('GET /client/tickets/1 with session returns 200', async () => {
      const res = await request('GET', '/client/tickets/1', { cookie });
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('Outlook'));
    });

    it('GET /client/tickets/999 returns 404', async () => {
      const res = await request('GET', '/client/tickets/999', { cookie });
      assert.equal(res.status, 404);
    });

    it('GET /client/tickets/new returns 200', async () => {
      const res = await request('GET', '/client/tickets/new', { cookie });
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('Submit'));
    });

    it('GET /client/onboarding returns 200', async () => {
      const res = await request('GET', '/client/onboarding', { cookie });
      assert.equal(res.status, 200);
    });

    // ── ORI routes ─────────────────────────────────────────────────────────

    it('GET /client/ori without session redirects to /login', async () => {
      const res = await request('GET', '/client/ori');
      assert.equal(res.status, 302);
      assert.ok(res.headers.location.includes('/login'));
    });

    it('GET /client/ori with session returns 200', async () => {
      const res = await request('GET', '/client/ori', { cookie });
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('Resilience') || res.body.includes('ORI') || res.body.includes('Assessment'));
    });

    it('GET /client/ori/assessment returns 200 with assessment form', async () => {
      const res = await request('GET', '/client/ori/assessment', { cookie });
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('mfa_enforced') || res.body.includes('assessment') || res.body.includes('Identity'));
    });

    it('POST /client/ori/assessment with full responses redirects to results', async () => {
      const body = {
        mfa_enforced: 'yes', no_shared_creds: 'yes', password_manager: 'no',
        least_privilege: 'yes', access_review: 'no', offboarding: 'yes',
        backup_exists: 'yes', backup_tested: 'yes', offsite_backup: 'no',
        data_classified: 'yes', dr_plan: 'no', recovery_time: 'yes',
        antivirus_edr: 'yes', firewall: 'yes', patch_management: 'no',
        security_training: 'yes', incident_response: 'no', vpn_remote: 'yes',
      };
      const res = await request('POST', '/client/ori/assessment', { body, cookie });
      assert.equal(res.status, 302);
      assert.ok(res.headers.location.includes('/client/ori/results/'));
    });

    it('GET /client/ori/results/:id returns 200 with score', async () => {
      // Submit an assessment first to get a valid id
      const body = {
        mfa_enforced: 'yes', no_shared_creds: 'no', password_manager: 'no',
        least_privilege: 'no', access_review: 'no', offboarding: 'no',
        backup_exists: 'yes', backup_tested: 'no', offsite_backup: 'no',
        data_classified: 'no', dr_plan: 'no', recovery_time: 'no',
        antivirus_edr: 'no', firewall: 'no', patch_management: 'no',
        security_training: 'no', incident_response: 'no', vpn_remote: 'no',
      };
      const post = await request('POST', '/client/ori/assessment', { body, cookie });
      assert.equal(post.status, 302);
      const location = post.headers.location;
      const res = await request('GET', location, { cookie });
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('Resilience') || res.body.includes('score') || res.body.includes('pillar'));
    });

    it('GET /client/ori/results/999999 returns 404', async () => {
      const res = await request('GET', '/client/ori/results/999999', { cookie });
      assert.equal(res.status, 404);
    });
  });

  // ── Admin auth flow ───────────────────────────────────────────────────────

  describe('admin login', () => {
    it('POST /admin/login with valid creds redirects to /admin', async () => {
      const res = await request('POST', '/admin/login', {
        body: { email: 'admin@9ksystems.net', password: 'admin-pass' },
      });
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, '/admin');
    });

    it('POST /admin/login with wrong password shows error', async () => {
      const res = await request('POST', '/admin/login', {
        body: { email: 'admin@9ksystems.net', password: 'wrong' },
      });
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('Invalid'));
    });
  });

  // ── Protected admin routes ────────────────────────────────────────────────

  describe('protected admin routes', () => {
    let cookie;

    before(async () => {
      const res = await request('POST', '/admin/login', {
        body: { email: 'admin@9ksystems.net', password: 'admin-pass' },
      });
      cookie = getCookie(res);
    });

    it('GET /admin without session redirects to /admin/login', async () => {
      const res = await request('GET', '/admin');
      assert.equal(res.status, 302);
      assert.ok(res.headers.location.includes('/admin/login'));
    });

    it('GET /admin with session returns 200 dashboard', async () => {
      const res = await request('GET', '/admin', { cookie });
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('Admin Dashboard'));
    });

    it('GET /admin/clients returns 200', async () => {
      const res = await request('GET', '/admin/clients', { cookie });
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('Acme Corp'));
    });

    it('GET /admin/clients/1 returns 200', async () => {
      const res = await request('GET', '/admin/clients/1', { cookie });
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('Acme Corp'));
    });

    it('GET /admin/tickets returns 200', async () => {
      const res = await request('GET', '/admin/tickets', { cookie });
      assert.equal(res.status, 200);
    });

    it('GET /admin/tickets/1 returns 200 with update form', async () => {
      const res = await request('GET', '/admin/tickets/1', { cookie });
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('Update Ticket') || res.body.includes('Save update'));
    });
  });
});
