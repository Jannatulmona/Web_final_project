document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const d = await api('/api/auth/login', 'POST', {
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    });
    location.href = d.role === 'admin' ? '/admin' : '/dashboard';
  } catch (err) { showMsg(err.message); }
});
