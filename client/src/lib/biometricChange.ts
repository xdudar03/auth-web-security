import { User } from '@/hooks/useUserContext';

export async function handleBiometricChange(user: User) {
  const { username, embedding } = user;
  console.log('Embedding:', embedding);
  if (!embedding) {
    throw new Error('Embedding is required');
  }
  const shortenedEmbedding = embedding.slice(0, 128);
  const response = await fetch('/api/biometric/change', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, embedding: shortenedEmbedding }),
  });
  const data = await response.json();
  console.log('Data:', data);
  if (response.status !== 200) {
    throw new Error('Biometric change failed: ' + data.error);
  }
  return data;
}
