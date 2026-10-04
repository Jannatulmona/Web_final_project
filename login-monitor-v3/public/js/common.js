// ---------- helpers shared by all pages ----------
async function api(url, method = 'GET', body) {
  const opt = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' };
  if (body) opt.body = JSON.stringify(body);
  const r = await fetch(url, opt);
  let d = {};
  try { d = await r.json(); } catch (e) { /* no body */ }
  if (!r.ok) { const e = new Error(d.error || 'Something went wrong.'); e.status = r.status; throw e; }
  return d;
}
// escape everything that comes from the server before putting it in innerHTML (XSS protection)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = iso => iso ? new Date(iso).toLocaleString() : '-';
const badge = (s, label) => `<span class="badge b-${esc(s)}">${esc(label || s)}</span>`;
const newIpNote = r => r.is_new_ip ? badge('locked', 'new IP') : '';
function showMsg(text, type = 'error') {
  const m = document.getElementById('msg');
  if (m) { m.textContent = text; m.className = 'alert ' + type; }
}
function setRows(id, html, cols) {
  document.getElementById(id).innerHTML = html || `<tr><td colspan="${cols}" class="muted">Nothing to show yet.</td></tr>`;
}
function card(num, label, cls = '') {
  return `<div class="card ${cls}"><div class="num">${esc(num)}</div><div class="lbl">${esc(label)}</div></div>`;
}

const LINKS = {
  user: [['/', 'Home'], ['/dashboard', 'Dashboard'], ['/history', 'My login history'], ['/profile', 'Profile'], ['/change-password', 'Password']],
  admin: [['/', 'Home'], ['/admin', 'Dashboard'], ['/admin/logs', 'All logs'], ['/admin/locked', 'Locked'], ['/admin/ips', 'IP report'], ['/admin/users', 'Users'], ['/profile', 'Profile']]
};
const GUEST_LINKS = [['/', 'Home'], ['/login', 'Log in'], ['/register', 'Register']];
function navShell(links, right) {
  const nav = document.getElementById('nav');
  nav.className = 'nav';
  nav.innerHTML = `<a class="brand" href="/">Login Monitor</a>
    <button id="menuBtn" class="menu-btn" aria-label="Menu" aria-expanded="false">&#9776;</button>
    <div class="nav-links"><nav>${links.map(([h, t]) => `<a href="${h}" class="${location.pathname === h ? 'active' : ''}">${t}</a>`).join('')}</nav>${right}</div>`;
  const btn = document.getElementById('menuBtn');
  btn.onclick = () => btn.setAttribute('aria-expanded', nav.classList.toggle('open'));
}
function buildNav(me) {
  navShell(LINKS[me.role], `<div class="who">${esc(me.name)} ${badge(me.role)}<button id="logout" class="btn small">Log out</button></div>`);
  document.getElementById('logout').onclick = async () => { await api('/api/auth/logout', 'POST'); location.href = '/login'; };
}
function buildGuestNav() { navShell(GUEST_LINKS, ''); }

// Resolves with the logged-in user (or null if redirecting). Page scripts do: ready.then(me => ...)
const ready = (async () => {
  const access = document.body.dataset.access;
  let me = null;
  try { me = await api('/api/user/me'); } catch (e) { /* not logged in */ }
  if (access === 'landing') { me ? buildNav(me) : buildGuestNav(); return me; }
  if (access !== 'public' && !me) { location.href = '/login'; return null; }
  if (access === 'admin' && me.role !== 'admin') { location.href = '/dashboard'; return null; }
  if (access === 'public' && me) { location.href = me.role === 'admin' ? '/admin' : '/dashboard'; return null; }
  if (me) buildNav(me);
  return me;
})();
