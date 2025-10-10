import type { User } from "@/hooks/useUserContext";

export async function handleAuthenticate(user: User) {
  const { username, password } = user;
  
  const response = await fetch('/api/biometric/authentication', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  console.log('Data:', data);
  return data;
}