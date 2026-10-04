document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  const password = document.getElementById('password').value;
  if (password !== document.getElementById('confirm').value) return showMsg('Passwords do not match.');
  try {
    await api('/api/auth/register', 'POST', {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      password
    });
    showMsg('Account created. Redirecting to log in...', 'success');
    setTimeout(() => location.href = '/login', 1200);
  } catch (err) { showMsg(err.message); }
});
