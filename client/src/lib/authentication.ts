import { startAuthentication } from '@simplewebauthn/browser';

export async function handleAuthenticate(username: string, userId: string) {
  try {
    const optionsRes = await fetch(
      'http://localhost:4000/passwordless/authentication/options',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, userId }),
        credentials: 'include',
      }
    );
    console.log('OPTIONS RES:', optionsRes);
    if (!optionsRes.ok) {
      console.error('Server error', await optionsRes.text());
      return;
    }
    const options = await optionsRes.json();

    let attResp;
    try {
      attResp = await startAuthentication({ optionsJSON: options });
    } catch (error) {
      console.error('Error starting authentication', error);
      return;
    }

    const verifyRes = await fetch(
      'http://localhost:4000/passwordless/authentication/verify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attResp),
        credentials: 'include',
      }
    );
    console.log(await verifyRes.json());
  } catch (error) {
    console.error(error);
  }
}
