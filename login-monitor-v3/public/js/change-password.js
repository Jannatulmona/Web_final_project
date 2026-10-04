document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  const next = document.getElementById('next').value;
  if (next !== document.getElementById('confirm').value) return showMsg('New passwords do not match.');
  try {
    await api('/api/user/change-password', 'POST', { currentPassword: document.getElementById('current').value, newPassword: next });
    e.target.reset();
    showMsg('Password changed.', 'success');
  } catch (err) { showMsg(err.message); }
});
