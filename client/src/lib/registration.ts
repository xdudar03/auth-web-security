import { startRegistration } from '@simplewebauthn/browser';

export async function handleRegister(username: string, credentials: any) {
  try {
    const optionsRes = await fetch(
      'http://localhost:4000/registration/options',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, credentials }),
        credentials: 'include',
      }
    );
    console.log('OPTIONS RES:', optionsRes);

    if (!optionsRes.ok) {
      console.error('Server error', await optionsRes.text());
      return;
    }

    const options = await optionsRes.json();
    const attResp = await startRegistration({ optionsJSON: options });

    const verifyRes = await fetch('http://localhost:4000/registration/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attResp),
      credentials: 'include',
    });
    console.log(await verifyRes.json());
  } catch (error) {
    console.error(error);
  }
}
