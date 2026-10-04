async function load() {
  const d = await api('/api/admin/ips');
  setRows('blocked', d.blocked.map(b => `<tr><td>${esc(b.ip_address)}</td><td class="wrap">${esc(b.reason)}</td><td>${esc(b.blocked_by)}</td><td>${fmt(b.created_at)}</td>
    <td><button class="btn small" data-act="unblock" data-ip="${esc(b.ip_address)}">Unblock</button></td></tr>`).join(''), 5);
  setRows('rows', d.ips.map(i => `<tr><td>${esc(i.ip_address)}</td><td>${i.total}</td><td>${i.failed}</td><td>${i.success}</td><td>${fmt(i.last_seen)}</td>
    <td>${i.blocked ? badge('blocked') : `<button class="btn small danger" data-act="block" data-ip="${esc(i.ip_address)}">Block</button>`}</td></tr>`).join(''), 6);
}
async function act(path, body, okText) {
  try { await api(path, 'POST', body); showMsg(okText, 'success'); load(); } catch (err) { showMsg(err.message); }
}
document.addEventListener('click', e => {
  const { act: a, ip } = e.target.dataset;
  if (a === 'block') act('/api/admin/block-ip', { ip, reason: 'Blocked from IP report' }, 'IP blocked.');
  if (a === 'unblock') act('/api/admin/unblock-ip', { ip }, 'IP unblocked.');
});
document.getElementById('blockForm').addEventListener('submit', e => {
  e.preventDefault();
  act('/api/admin/block-ip', { ip: document.getElementById('ip').value, reason: document.getElementById('reason').value }, 'IP blocked.');
  e.target.reset();
});
ready.then(me => { if (me) load(); });
