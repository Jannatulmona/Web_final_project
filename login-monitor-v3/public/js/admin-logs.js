const ids = ['status', 'email', 'ip', 'from', 'to'];
function qs() {
  const p = new URLSearchParams();
  ids.forEach(i => { const v = document.getElementById(i).value.trim(); if (v) p.set(i, v); });
  return p.toString();
}
async function load() {
  document.getElementById('csv').href = '/api/admin/logs.csv?' + qs();
  const rows = await api('/api/admin/logs?' + qs());
  setRows('rows', rows.map(r => `<tr><td>${fmt(r.created_at)}</td><td>${esc(r.email_tried)}</td><td>${esc(r.name || '-')}</td><td>${esc(r.ip_address)}</td><td>${badge(r.status)}</td><td>${newIpNote(r)}</td><td class="wrap">${esc(r.user_agent)}</td></tr>`).join(''), 7);
}
ready.then(me => { if (me) load(); });
document.getElementById('filters').addEventListener('submit', e => { e.preventDefault(); load(); });
