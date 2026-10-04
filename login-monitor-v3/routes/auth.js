const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../database');
const { getIp, emailRe, isStrong, PASSWORD_RULE } = require('../utils');

const MAX_ATTEMPTS = 5;          // wrong passwords before lock
const LOCK_MINUTES = 15;         // lock duration
const AUTO_BLOCK_FAILS = 20;     // failed logins from one IP ...
const AUTO_BLOCK_WINDOW = 10;    // ... within this many minutes => IP auto-blocked
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10); // keeps timing equal for unknown emails

router.post('/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = req.body.password;
  if (name.length < 2 || name.length > 60) return res.status(400).json({ error: 'Name must be 2-60 characters.' });
  if (!emailRe.test(email) || email.length > 100) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!isStrong(password)) return res.status(400).json({ error: PASSWORD_RULE });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email))
    return res.status(409).json({ error: 'This email is already registered.' });
  const hash = await bcrypt.hash(password, 10);
  db.prepare('INSERT INTO users (name,email,password_hash,created_at) VALUES (?,?,?,?)')
    .run(name, email, hash, new Date().toISOString());
  res.json({ ok: true });
});

router.post('/login', async (req, res) => {
  const ip = getIp(req);
  const ua = (req.get('user-agent') || '').slice(0, 200);
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 100);
  const password = String(req.body.password || '').slice(0, 100);
  const now = Date.now();

  const log = (userId, status, isNew = 0) =>
    db.prepare('INSERT INTO login_logs (user_id,email_tried,ip_address,user_agent,status,is_new_ip,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(userId, email, ip, ua, status, isNew, new Date().toISOString());

  // 1. Is the IP blocked?
  if (db.prepare('SELECT 1 FROM blocked_ips WHERE ip_address = ?').get(ip)) {
    log(null, 'blocked');
    return res.status(403).json({ error: 'Your IP address is blocked. Contact the administrator.' });
  }

  // 2. Find user (unknown email gets the same generic error)
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    log(null, 'failed'); autoBlock(ip);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // 3. Is the account locked?
  if (user.locked_until > now) {
    log(user.id, 'locked');
    const mins = Math.ceil((user.locked_until - now) / 60000);
    return res.status(423).json({ error: `Account locked. Try again in ${mins} minute(s).` });
  }

  // 4. Check password
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    let attempts = user.failed_attempts + 1;
    let lockedUntil = 0;
    if (attempts >= MAX_ATTEMPTS) { lockedUntil = now + LOCK_MINUTES * 60000; attempts = 0; }
    db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(attempts, lockedUntil, user.id);
    log(user.id, 'failed'); autoBlock(ip);
    if (lockedUntil) return res.status(423).json({ error: `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.` });
    return res.status(401).json({ error: `Invalid email or password. ${MAX_ATTEMPTS - attempts} attempt(s) left.` });
  }

  if (!user.is_active) {
    log(user.id, 'failed');
    return res.status(403).json({ error: 'This account is deactivated. Contact the administrator.' });
  }

  // 5. Success: detect new IP, reset counters, start a fresh session
  const prev = db.prepare("SELECT COUNT(*) c, SUM(ip_address = ?) same FROM login_logs WHERE user_id = ? AND status = 'success'").get(ip, user.id);
  const isNew = prev.c > 0 && !prev.same ? 1 : 0;
  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = 0 WHERE id = ?').run(user.id);
  log(user.id, 'success', isNew);
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Could not start session.' });
    req.session.userId = user.id;
    res.json({ ok: true, role: user.role, newIp: !!isNew });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => { res.clearCookie('connect.sid'); res.json({ ok: true }); });
});

function autoBlock(ip) {
  const since = new Date(Date.now() - AUTO_BLOCK_WINDOW * 60000).toISOString();
  const n = db.prepare("SELECT COUNT(*) c FROM login_logs WHERE ip_address = ? AND status = 'failed' AND created_at >= ?").get(ip, since).c;
  if (n >= AUTO_BLOCK_FAILS) {
    db.prepare('INSERT OR IGNORE INTO blocked_ips (ip_address,reason,blocked_by,created_at) VALUES (?,?,?,?)')
      .run(ip, `Auto-blocked: ${n} failed logins in ${AUTO_BLOCK_WINDOW} minutes`, 'system', new Date().toISOString());
  }
}

module.exports = router;
