const audit = require('./audit');

function requireClient(req, res, next) {
  if (req.session?.client) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session?.admin) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/admin/login');
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session?.admin) return res.redirect('/admin/login');
    if (req.session.admin.role !== role && req.session.admin.role !== 'admin') {
      return res.status(403).render('error', { message: 'Access denied.', status: 403, user: null });
    }
    next();
  };
}

module.exports = { requireClient, requireAdmin, requireRole };
