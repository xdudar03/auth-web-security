import { User } from '@/hooks/useUserContext';

export async function changeUserInfo(userId: string, updates: User) {
  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error changing user info', error);
    throw error;
  }
}
