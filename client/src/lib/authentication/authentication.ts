import type { User } from '@/hooks/useUserContext';

export async function handleAuthenticate(user: User) {
  // const { username, password } = user;
  const username = 'test';
  const password = 'test';

  const response = await fetch('/api/biometric/authentication', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (response.status !== 200) {
    throw new Error('Authentication failed: ' + data.error);
  }
  console.log('Data:', data);
  return data.response;
}
