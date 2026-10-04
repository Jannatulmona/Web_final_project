const { DatabaseSync } = require('node:sqlite');  // built into Node.js (22.13+ / 24), no build tools needed
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'data.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  email_tried TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL,            -- success | failed | locked | blocked
  is_new_ip INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_logs_ip ON login_logs(ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_logs_user ON login_logs(user_id, created_at);
CREATE TABLE IF NOT EXISTS blocked_ips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT,
  blocked_by TEXT,
  created_at TEXT NOT NULL
);
`);

// Default admin account (change this password after first login!)
if (!db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) {
  db.prepare('INSERT INTO users (name,email,password_hash,role,created_at) VALUES (?,?,?,?,?)')
    .run('Security Admin', 'admin@example.com', bcrypt.hashSync('Admin@123', 10), 'admin', new Date().toISOString());
  console.log('Default admin created: admin@example.com / Admin@123');
}

// Delete a user but KEEP their login logs (audit trail): logs are detached, not removed
db.deleteUser = id => {
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE login_logs SET user_id = NULL WHERE user_id = ?').run(id);
    const r = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    db.exec('COMMIT');
    return r.changes;
  } catch (e) { db.exec('ROLLBACK'); throw e; }
};

module.exports = db;
