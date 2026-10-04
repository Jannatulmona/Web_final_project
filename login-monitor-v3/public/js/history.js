ready.then(async me => {
  if (!me) return;
  const rows = await api('/api/user/history');
  setRows('rows', rows.map(r => `<tr><td>${fmt(r.created_at)}</td><td>${esc(r.ip_address)}</td><td class="wrap">${esc(r.user_agent)}</td><td>${badge(r.status)}</td><td>${newIpNote(r)}</td></tr>`).join(''), 5);
});
