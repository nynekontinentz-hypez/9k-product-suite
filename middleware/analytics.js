const pageViews = require('../db/page-views');

module.exports = function analytics(req, res, next) {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/public') || req.path.startsWith('/favicon')) return next();

  const actorType = req.session?.admin ? 'admin' : req.session?.client ? 'client' : null;
  const actorId = req.session?.admin?.id || req.session?.client?.id || null;
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

  pageViews.record(req.path, actorType, actorId, ip, req.headers['user-agent']).catch(() => {});
  next();
};
