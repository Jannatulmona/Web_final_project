// Normalise client IP (::1 -> 127.0.0.1, ::ffff:1.2.3.4 -> 1.2.3.4)
function getIp(req) {
  let ip = (req.ip || '').replace('::ffff:', '');
  if (ip === '::1') ip = '127.0.0.1';
  return ip || 'unknown';
}
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isStrong = p => typeof p === 'string' && p.length >= 8 && p.length <= 100 &&
  /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);
const PASSWORD_RULE = 'Password must be 8+ characters with an uppercase letter, a lowercase letter and a number.';
module.exports = { getIp, emailRe, isStrong, PASSWORD_RULE };
