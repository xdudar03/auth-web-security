export async function handleChangePassword(
  username: string,
  oldPassword: string,
  newPassword: string
) {
  const response = await fetch('/api/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, oldPassword, newPassword }),
  });
  const data = await response.json();
  console.log('Data:', data);
  if (response.status !== 200) {
    throw new Error('Password change failed: ' + data.error);
  }
  return data;
}
