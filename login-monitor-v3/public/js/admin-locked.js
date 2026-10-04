async function load() {
  const rows = await api('/api/admin/locked');
  setRows('rows', rows.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${fmt(new Date(u.locked_until).toISOString())}</td>
    <td><button class="btn small primary" data-id="${u.id}">Unlock</button></td></tr>`).join(''), 4);
}
document.getElementById('rows').addEventListener('click', async e => {
  const id = e.target.dataset.id;
  if (!id) return;
  try { await api('/api/admin/unlock/' + id, 'POST'); showMsg('Account unlocked.', 'success'); load(); }
  catch (err) { showMsg(err.message); }
});
ready.then(me => { if (me) load(); });
