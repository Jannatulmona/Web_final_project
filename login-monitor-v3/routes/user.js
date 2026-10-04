const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../database');
const { requireLogin } = require('../middleware/auth');
const { isStrong, PASSWORD_RULE, emailRe } = require('../utils');

router.use(requireLogin);

router.get('/me', (req, res) => res.json(req.user));

router.get('/summary', (req, res) => {
  const id = req.user.id;
  const last = db.prepare("SELECT ip_address,created_at,is_new_ip FROM login_logs WHERE user_id = ? AND status = 'success' ORDER BY id DESC LIMIT 2").all(id);
  const day = new Date(Date.now() - 864e5).toISOString();
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const failed24 = db.prepare("SELECT COUNT(*) c FROM login_logs WHERE user_id = ? AND status IN ('failed','locked') AND created_at >= ?").get(id, day).c;
  const newIp7d = db.prepare('SELECT COUNT(*) c FROM login_logs WHERE user_id = ? AND is_new_ip = 1 AND created_at >= ?').get(id, week).c;
  res.json({ current: last[0] || null, previous: last[1] || null, failed24, newIp7d });
});

router.get('/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 200);
  res.json(db.prepare('SELECT id,ip_address,user_agent,status,is_new_ip,created_at FROM login_logs WHERE user_id = ? ORDER BY id DESC LIMIT ?').all(req.user.id, limit));
});

router.post('/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!(await bcrypt.compare(String(currentPassword || ''), row.password_hash)))
    return res.status(400).json({ error: 'Current password is incorrect.' });
  if (!isStrong(newPassword)) return res.status(400).json({ error: PASSWORD_RULE });
  if (newPassword === currentPassword) return res.status(400).json({ error: 'New password must be different from the current one.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await bcrypt.hash(newPassword, 10), req.user.id);
  res.json({ ok: true });
});

router.get('/profile', (req, res) => {
  const id = req.user.id;
  const u = db.prepare('SELECT id,name,email,role,created_at FROM users WHERE id = ?').get(id);
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const c = (st, since) => db.prepare('SELECT COUNT(*) c FROM login_logs WHERE user_id = ? AND status = ? AND created_at >= ?').get(id, st, since).c;
  const total = db.prepare("SELECT COUNT(*) c FROM login_logs WHERE user_id = ? AND status = 'success'").get(id).c;
  const f = c('failed', week), k = c('locked', week);
  const n = db.prepare('SELECT COUNT(*) c FROM login_logs WHERE user_id = ? AND is_new_ip = 1 AND created_at >= ?').get(id, week).c;
  res.json({ ...u, stats: { totalLogins: total, failed7d: f, newIp7d: n, risk: Math.min(100, f * 5 + k * 3 + n * 10) } });
});

router.put('/profile', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  if (name.length < 2 || name.length > 60) return res.status(400).json({ error: 'Name must be 2-60 characters.' });
  if (!emailRe.test(email) || email.length > 100) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (email !== req.user.email) {   // changing the email needs the current password
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!(await bcrypt.compare(String(req.body.password || ''), row.password_hash)))
      return res.status(400).json({ error: 'Enter your current password to change your email.' });
    if (db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(email, req.user.id))
      return res.status(409).json({ error: 'This email is already in use.' });
  }
  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, req.user.id);
  res.json({ ok: true });
});

router.delete('/account', async (req, res) => {
  if (req.user.role === 'admin') return res.status(400).json({ error: 'Admin accounts cannot be self-deleted.' });
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!(await bcrypt.compare(String(req.body.password || ''), row.password_hash)))
    return res.status(400).json({ error: 'Password is incorrect.' });
  db.deleteUser(req.user.id);
  req.session.destroy(() => { res.clearCookie('connect.sid'); res.json({ ok: true }); });
});

module.exports = router;
