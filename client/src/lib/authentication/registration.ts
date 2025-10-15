import type { User } from '@/hooks/useUserContext';

export async function handleRegister(user: User) {
  const { username, email, password, id, roleId } = user;
  console.log('username, password, id', username, password, id, roleId);
  if (!username || !password || !id || !email) {
    throw new Error('Username, password and email are required');
  }
  try {
    const response = await fetch('/api/biometric/registration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        email,
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
