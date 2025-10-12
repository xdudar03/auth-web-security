import { User } from '@/hooks/useUserContext';
import { startRegistration } from '@simplewebauthn/browser';

// no-op: previous manual buffer conversion removed; using startRegistration

export async function handleOptions(user: User) {
  const { username, id } = user;
  if (!username || !id) {
    throw new Error('Username and id are required');
  }
  try {
    const optionsResponse = await fetch(
      '/api/passwordless/registration/options',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
        credentials: 'include',
      }
    );
    if (!optionsResponse.ok) {
      throw new Error(await optionsResponse.text());
    }
    const options = await optionsResponse.json();
    const attResp = await startRegistration({ optionsJSON: options });
    return attResp;
  } catch (error) {
    console.error('Error fetching registration options', error);
    throw new Error('Error fetching registration options: ' + error);
  }
}

export async function handleRegisterPasskey(
  username: string,
  credentials: unknown
) {
  try {
    const verifyRes = await fetch('/api/passwordless/registration/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      credentials: 'include',
    });
    const json = await verifyRes.json();
    return verifyRes.ok && json?.verified === true;
  } catch (error) {
    console.error(error);
    return false;
  }
}
