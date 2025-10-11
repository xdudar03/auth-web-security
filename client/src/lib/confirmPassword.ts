export async function handleConfirmPassword(
  username: string,
  password: string
) {
  const response = await fetch('/api/confirm-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (response.status !== 200) {
    throw new Error('Password confirmation failed: ' + data.error);
  }
  return data;
}
