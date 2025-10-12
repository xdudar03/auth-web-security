import type { User } from '@/hooks/useUserContext';

export async function handleRegister(user: User) {
  const { username, password, id, roleId } = user;
  console.log('username, password, id', username, password, id, roleId);
  if (!username || !password || !id) {
    throw new Error('Username, password, and id are required');
  }
  try {
    const response = await fetch('/api/biometric/registration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
        embedding: '',
        id,
        roleId,
      }),
    });
    console.log('Response:', response);
    if (!response.ok) {
      throw new Error('Registration failed: ' + response.statusText);
    }
    const data = await response.json();
    console.log('Data:', data);
    return data.response;
  } catch (error) {
    console.error('Error registering user', error);
    return null;
  }
}
