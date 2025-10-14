export const getUserInfo = async (id: string) => {
  try {
    const response = await fetch(`/api/admin/users/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }
    const data = await response.json();
    console.log('data', data);
    return JSON.parse(data);
  } catch (error) {
    console.error('Error fetching user info', error);
    return null;
  }
};
