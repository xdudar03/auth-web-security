import type { User } from '@/hooks/useUserContext';

export async function handleRegister(user: User) {
  const { username, password, id, roleId } = user;
  console.log('username, password, id', username, password, id, roleId);
  if (!username || !password || !id) {
    throw new Error('Username, password, and id are required');
  }
  // if (!embedding) {
  //   throw new Error('Embedding is required');
  // }
  // shorten embedding to 128 bits
  // const shortenedEmbedding = embedding.slice(0, 128);
  // console.log('Shortened embedding:', shortenedEmbedding);
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
    const data = await response.json();
    if (data.status !== 200) {
      throw new Error('Registration failed: ' + data.error);
    }
    console.log('Data:', data);
    return data;
  } catch (error) {
    console.error('Error registering user', error);
    return null;
  }
}
