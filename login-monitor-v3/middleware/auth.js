const db = require('../database');

function currentUser(req) {
  if (!req.session.userId) return null;
  const u = db.prepare('SELECT id,name,email,role,is_active FROM users WHERE id = ?').get(req.session.userId);
  return u && u.is_active ? u : null;   // re-checked on every request: deactivation/role change applies instantly
}

exports.requireLogin = (req, res, next) => {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Please log in first.' });
  req.user = u;
  next();
};

// page-level guards (redirect instead of JSON)
exports.pageLogin = (req, res, next) => currentUser(req) ? next() : res.redirect('/login');
exports.pageAdmin = (req, res, next) => {
  const u = currentUser(req);
  if (!u) return res.redirect('/login');
  return u.role === 'admin' ? next() : res.redirect('/dashboard');
};
