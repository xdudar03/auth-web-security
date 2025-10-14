export const getAllUsers = async () => {
  try {
    const response = await fetch('/api/admin/users', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    const data = await response.json();
    return data.users;
  } catch (error) {
    console.error('Error fetching users', error);
    return [];
  }
};
