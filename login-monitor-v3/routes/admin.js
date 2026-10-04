const router = require('express').Router();
const db = require('../database');
const { requireLogin } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');
const { getIp } = require('../utils');

router.use(requireLogin, requireAdmin);

router.get('/stats', (req, res) => {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const one = (sql, ...p) => db.prepare(sql).get(...p).c;
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(new Date(now - i * 864e5).toISOString().slice(0, 10));
  const rows = db.prepare('SELECT substr(created_at,1,10) d, status, COUNT(*) c FROM login_logs WHERE created_at >= ? GROUP BY d, status').all(days[0]);
  const pick = st => days.map(d => (rows.find(r => r.d === d && r.status === st) || { c: 0 }).c);
  res.json({
    totalUsers: one('SELECT COUNT(*) c FROM users'),
    successToday: one("SELECT COUNT(*) c FROM login_logs WHERE status='success' AND created_at >= ?", today),
    failedToday: one("SELECT COUNT(*) c FROM login_logs WHERE status='failed' AND created_at >= ?", today),
    lockedNow: one('SELECT COUNT(*) c FROM users WHERE locked_until > ?', now),
    blockedIps: one('SELECT COUNT(*) c FROM blocked_ips'),
    daily: { labels: days.map(d => d.slice(5)), success: pick('success'), failed: pick('failed') }
  });
});

function buildLogQuery(q) {
  const w = [], p = [];
  if (q.status) { w.push('l.status = ?'); p.push(q.status); }
  if (q.ip) { w.push('l.ip_address LIKE ?'); p.push('%' + q.ip + '%'); }
  if (q.email) { w.push('l.email_tried LIKE ?'); p.push('%' + q.email.toLowerCase() + '%'); }
  if (q.from) { w.push('l.created_at >= ?'); p.push(q.from); }
  if (q.to) { w.push('l.created_at <= ?'); p.push(q.to + 'T23:59:59.999Z'); }
  return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', params: p };
}
const LOG_SQL = 'SELECT l.id,l.email_tried,u.name,l.ip_address,l.user_agent,l.status,l.is_new_ip,l.created_at FROM login_logs l LEFT JOIN users u ON u.id = l.user_id';

router.get('/logs', (req, res) => {
  const { where, params } = buildLogQuery(req.query);
  const limit = Math.min(parseInt(req.query.limit) || 200, 500);
  res.json(db.prepare(`${LOG_SQL} ${where} ORDER BY l.id DESC LIMIT ?`).all(...params, limit));
});

router.get('/logs.csv', (req, res) => {
  const { where, params } = buildLogQuery(req.query);
  const rows = db.prepare(`${LOG_SQL} ${where} ORDER BY l.id DESC LIMIT 5000`).all(...params);
  // prefix risky characters so spreadsheets don't run user input as a formula (CSV injection)
  const cell = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const head = ['id', 'time', 'email_tried', 'name', 'ip', 'status', 'new_ip', 'user_agent'];
  const lines = rows.map(r => [r.id, r.created_at, r.email_tried, r.name, r.ip_address, r.status, r.is_new_ip, r.user_agent].map(cell).join(','));
  res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="login-logs.csv"' });
  res.send([head.join(','), ...lines].join('\n'));
});

router.get('/locked', (req, res) => {
  res.json(db.prepare('SELECT id,name,email,locked_until,failed_attempts FROM users WHERE locked_until > ? ORDER BY locked_until DESC').all(Date.now()));
});

router.post('/unlock/:id', (req, res) => {
  const r = db.prepare('UPDATE users SET locked_until = 0, failed_attempts = 0 WHERE id = ?').run(req.params.id);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'User not found.' });
});

router.get('/ips', (req, res) => {
  const ips = db.prepare(`SELECT l.ip_address, COUNT(*) total, SUM(l.status='failed') failed, SUM(l.status='success') success,
    MAX(l.created_at) last_seen, EXISTS(SELECT 1 FROM blocked_ips b WHERE b.ip_address = l.ip_address) blocked
    FROM login_logs l GROUP BY l.ip_address ORDER BY failed DESC, total DESC LIMIT 100`).all();
  const blocked = db.prepare('SELECT * FROM blocked_ips ORDER BY id DESC').all();
  res.json({ ips, blocked });
});

router.post('/block-ip', (req, res) => {
  const ip = String(req.body.ip || '').trim();
  const reason = String(req.body.reason || 'Blocked by admin').trim().slice(0, 200);
  if (!/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return res.status(400).json({ error: 'Enter a valid IP address.' });
  if (ip === getIp(req)) return res.status(400).json({ error: 'You cannot block your own IP address.' });
  db.prepare('INSERT OR IGNORE INTO blocked_ips (ip_address,reason,blocked_by,created_at) VALUES (?,?,?,?)')
    .run(ip, reason, req.user.email, new Date().toISOString());
  res.json({ ok: true });
});

router.post('/unblock-ip', (req, res) => {
  db.prepare('DELETE FROM blocked_ips WHERE ip_address = ?').run(String(req.body.ip || ''));
  res.json({ ok: true });
});

router.get('/users', (req, res) => {
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const w = [], p = [];
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q) { w.push('(lower(u.name) LIKE ? OR u.email LIKE ?)'); p.push('%' + q + '%', '%' + q + '%'); }
  if (['user', 'admin'].includes(req.query.role)) { w.push('u.role = ?'); p.push(req.query.role); }
  if (req.query.status === 'active') w.push('u.is_active = 1');
  if (req.query.status === 'inactive') w.push('u.is_active = 0');
  if (req.query.status === 'locked') { w.push('u.locked_until > ?'); p.push(Date.now()); }
  const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const rows = db.prepare(`SELECT u.id,u.name,u.email,u.role,u.is_active,u.locked_until,u.created_at,
    (SELECT COUNT(*) FROM login_logs WHERE user_id=u.id AND status='failed' AND created_at>=?) f,
    (SELECT COUNT(*) FROM login_logs WHERE user_id=u.id AND status='locked' AND created_at>=?) k,
    (SELECT COUNT(*) FROM login_logs WHERE user_id=u.id AND is_new_ip=1 AND created_at>=?) n
    FROM users u ${where} ORDER BY u.id`).all(week, week, week, ...p);
  // Risk score (0-100): failed logins, attempts on a locked account and new-IP logins in the last 7 days
  res.json(rows.map(r => ({ ...r, risk: Math.min(100, r.f * 5 + r.k * 3 + r.n * 10) })));
});

router.delete('/users/:id', (req, res) => {
  if (+req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot delete yourself.' });
  db.deleteUser(+req.params.id) ? res.json({ ok: true }) : res.status(404).json({ error: 'User not found.' });
});

router.post('/users/:id/role', (req, res) => {
  const role = req.body.role;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
  if (+req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own role.' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ ok: true });
});

router.post('/users/:id/active', (req, res) => {
  if (+req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot deactivate yourself.' });
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(req.body.active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
