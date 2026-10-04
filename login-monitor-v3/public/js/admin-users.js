let myId = null;
function qs() {
  const p = new URLSearchParams();
  ['q', 'role', 'status'].forEach(i => { const v = document.getElementById(i).value.trim(); if (v) p.set(i, v); });
  return p.toString();
}
async function load() {
  const users = await api('/api/admin/users?' + qs());
  setRows('rows', users.map(u => {
    const locked = u.locked_until > Date.now();
    const lvl = u.risk >= 60 ? 'high' : u.risk >= 25 ? 'med' : 'low';
    return `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${badge(u.role)}</td>
      <td>${u.is_active ? badge('active') : badge('inactive')} ${locked ? badge('locked') : ''}</td>
      <td>${badge(lvl, u.risk)}</td>
      <td>${u.id === myId ? '<span class="muted">You</span>' :
        `<button class="btn small" data-act="role" data-id="${u.id}" data-role="${u.role === 'admin' ? 'user' : 'admin'}">Make ${u.role === 'admin' ? 'user' : 'admin'}</button>
         <button class="btn small" data-act="active" data-id="${u.id}" data-active="${u.is_active ? 0 : 1}">${u.is_active ? 'Deactivate' : 'Activate'}</button>
         <button class="btn small danger" data-act="delete" data-id="${u.id}" data-name="${esc(u.name)}">Delete</button>`}</td></tr>`;
  }).join(''), 6);
}
document.getElementById('rows').addEventListener('click', async e => {
  const d = e.target.dataset;
  if (!d.act) return;
  try {
    if (d.act === 'role') await api(`/api/admin/users/${d.id}/role`, 'POST', { role: d.role });
    if (d.act === 'active') await api(`/api/admin/users/${d.id}/active`, 'POST', { active: d.active === '1' });
    if (d.act === 'delete') {
      if (!confirm(`Delete user "${d.name}"? Their login records stay in the log.`)) return;
      await api(`/api/admin/users/${d.id}`, 'DELETE');
      showMsg('User deleted.', 'success');
    }
    load();
  } catch (err) { showMsg(err.message); }
});
document.getElementById('filters').addEventListener('submit', e => { e.preventDefault(); load(); });
document.getElementById('reset').addEventListener('click', () => setTimeout(load, 0));
ready.then(me => { if (me) { myId = me.id; load(); } });
