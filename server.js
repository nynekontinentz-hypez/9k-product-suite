require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3003;

// Behind Render's TLS-terminating proxy, trust X-Forwarded-Proto so Express
// recognises HTTPS and will issue Secure session cookies.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// Guard: crash loudly in production if SESSION_SECRET is missing
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET env var must be set in production.');
  process.exit(1);
}

// ── View engine ──────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// EJS's Express special-handling copies `data.client` into opts.client, which
// enables client-side mode and removes the include function. Pass opts explicitly
// to skip that path and keep includes working.
app.engine('ejs', (filePath, data, cb) => require('ejs').renderFile(filePath, data, {}, cb));

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── Static assets ────────────────────────────────────────────────────────────
app.use('/public', express.static(path.join(__dirname, 'public')));

// ── Sessions ─────────────────────────────────────────────────────────────────
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Dev: MemoryStore (lost on restart — fine for local preview).
// Production (Postgres): connect-pg-simple keeps sessions in the DB so they
// survive restarts and free-tier spin-downs.
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'dev-only-secret-not-for-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
};
if (db.isPostgres) {
  const PgStore = require('connect-pg-simple')(session);
  sessionConfig.store = new PgStore({ pool: db.getDb(), createTableIfMissing: true });
}
app.use(session(sessionConfig));

// ── Analytics middleware ──────────────────────────────────────────────────────
app.use(require('./middleware/analytics'));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/', require('./routes/auth'));
app.use('/client', require('./routes/client'));
app.use('/admin', require('./routes/admin'));

// ── Root: landing page for guests, redirect for authenticated users ────────────
app.get('/', (req, res) => {
  if (req.session?.admin) return res.redirect('/admin');
  if (req.session?.client) return res.redirect('/client');
  res.render('landing');
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found.', status: 404, user: null });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { message: 'Internal server error.', status: 500, user: null });
});

// Export app for testing; only listen when run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n9K Systems Portal → http://localhost:${PORT}`);
    console.log(`  Client login:  http://localhost:${PORT}/login`);
    console.log(`  Admin login:   http://localhost:${PORT}/admin/login`);
    console.log(`  Default admin: admin@9ksystems.net / change-me-on-first-login\n`);
  });
}

module.exports = app;
