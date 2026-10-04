let original = '';
function show(id, text, type) { const m = document.getElementById(id); m.textContent = text; m.className = 'alert ' + type; }

async function load() {
  const p = await api('/api/user/profile');
  original = p.email;
  document.getElementById('name').value = p.name;
  document.getElementById('email').value = p.email;
  const lvl = p.stats.risk >= 60 ? 'red' : p.stats.risk >= 25 ? 'amber' : '';
  document.getElementById('cards').innerHTML =
    card(new Date(p.created_at).toLocaleDateString(), 'Member since') +
    card(p.stats.totalLogins, 'Successful sign-ins') +
    card(p.stats.failed7d, 'Failed attempts (7 days)', p.stats.failed7d ? 'red' : '') +
    card(p.stats.risk + ' / 100', 'Risk score', lvl);
  if (p.role !== 'admin') document.getElementById('danger').classList.remove('hidden');
}

document.getElementById('email').addEventListener('input', e => {
  document.getElementById('pwRow').classList.toggle('hidden', e.target.value.trim().toLowerCase() === original);
});

document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('/api/user/profile', 'PUT', {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    });
    document.getElementById('password').value = '';
    show('msg', 'Profile updated.', 'success');
    await load(); buildNav(await api('/api/user/me')); document.getElementById('pwRow').classList.add('hidden');
  } catch (err) { show('msg', err.message, 'error'); }
});

document.getElementById('delBtn').addEventListener('click', async () => {
  if (!confirm('Delete your account permanently? This cannot be undone.')) return;
  try {
    await api('/api/user/account', 'DELETE', { password: document.getElementById('delPassword').value });
    location.href = '/';
  } catch (err) { show('msg2', err.message, 'error'); }
});

ready.then(me => { if (me) load(); });
