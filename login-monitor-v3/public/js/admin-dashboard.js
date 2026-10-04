ready.then(async me => {
  if (!me) return;
  const [s, logs] = await Promise.all([api('/api/admin/stats'), api('/api/admin/logs?limit=8')]);
  document.getElementById('cards').innerHTML =
    card(s.totalUsers, 'Registered users') + card(s.successToday, 'Successful sign-ins today') +
    card(s.failedToday, 'Failed sign-ins today', s.failedToday ? 'red' : '') +
    card(s.lockedNow, 'Locked accounts', s.lockedNow ? 'amber' : '') + card(s.blockedIps, 'Blocked IPs', s.blockedIps ? 'red' : '');
  setRows('rows', logs.map(r => `<tr><td>${fmt(r.created_at)}</td><td>${esc(r.email_tried)}</td><td>${esc(r.ip_address)}</td><td>${badge(r.status)}</td></tr>`).join(''), 4);
  if (typeof Chart === 'undefined') return;
  new Chart(document.getElementById('chart'), {
    type: 'bar',
    data: { labels: s.daily.labels, datasets: [
      { label: 'Successful', data: s.daily.success, backgroundColor: '#18794e' },
      { label: 'Failed', data: s.daily.failed, backgroundColor: '#b42318' }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
});
