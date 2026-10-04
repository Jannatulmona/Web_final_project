ready.then(async me => {
  if (!me) return;
  document.getElementById('welcome').textContent = 'Welcome, ' + me.name;
  const [s, rows] = await Promise.all([api('/api/user/summary'), api('/api/user/history?limit=5')]);
  const alerts = document.getElementById('alerts');
  if (s.current && s.current.is_new_ip)
    alerts.innerHTML += `<div class="alert warn">This sign-in came from a new IP address (${esc(s.current.ip_address)}). If it was not you, change your password now.</div>`;
  if (s.failed24 > 0)
    alerts.innerHTML += `<div class="alert error">${s.failed24} failed or locked attempt(s) on your account in the last 24 hours.</div>`;
  document.getElementById('cards').innerHTML =
    card(s.previous ? fmt(s.previous.created_at) : 'First sign-in', 'Previous sign-in') +
    card(s.previous ? s.previous.ip_address : '-', 'Previous IP address') +
    card(s.failed24, 'Failed attempts (24h)', s.failed24 ? 'red' : '') +
    card(s.newIp7d, 'New-IP sign-ins (7 days)', s.newIp7d ? 'amber' : '');
  setRows('rows', rows.map(r => `<tr><td>${fmt(r.created_at)}</td><td>${esc(r.ip_address)}</td><td>${badge(r.status)}</td><td>${newIpNote(r)}</td></tr>`).join(''), 4);
});
