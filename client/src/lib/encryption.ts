const enc = new TextEncoder();
const dec = new TextDecoder();

const ACTIVE_HPKE_PRIVATE_KEY = 'auth:active-hpke-private-jwk';
const ACTIVE_HPKE_PUBLIC_KEY = 'auth:active-hpke-public-key';
const USER_HPKE_PREFIX = 'auth:user-hpke:';

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function userHpkeKey(username: string): string {
  return `${USER_HPKE_PREFIX}${username.trim().toLowerCase()}`;
}

export async function generateHpkeKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
}

export async function exportHpkePublicKeyB64(
  publicKey: CryptoKey
): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  return bytesToBase64(new Uint8Array(spki));
}

export async function exportHpkePrivateKeyJwkB64(
  privateKey: CryptoKey
): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', privateKey);
  const serialized = JSON.stringify(jwk);
  return bytesToBase64(enc.encode(serialized));
}

export async function importHpkePrivateKeyJwkB64(
  privateKeyJwkB64: string
): Promise<CryptoKey> {
  const jwkJson = dec.decode(base64ToBytes(privateKeyJwkB64));
  const jwk = JSON.parse(jwkJson) as JsonWebKey;
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
}

export async function encryptWithHpkePublicKey(
  recipientPublicKeyB64: string,
  plaintext: string
): Promise<{
  ciphertextB64: string;
  ivB64: string;
  encapPublicKeyB64: string;
}> {
  const recipientPublicKey = await crypto.subtle.importKey(
    'spki',
    new Uint8Array(base64ToBytes(recipientPublicKeyB64)),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const ephemeral = await generateHpkeKeyPair();
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: recipientPublicKey },
    ephemeral.privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    enc.encode(plaintext)
  );
  const encapPublicKeyB64 = await exportHpkePublicKeyB64(ephemeral.publicKey);

  return {
    ciphertextB64: bytesToBase64(new Uint8Array(ciphertext)),
    ivB64: bytesToBase64(iv),
    encapPublicKeyB64,
  };
}

export async function decryptWithHpkePrivateKey(
  recipientPrivateKey: CryptoKey,
  ciphertextB64: string,
  ivB64: string,
  encapPublicKeyB64: string
): Promise<string> {
  const ciphertext = base64ToBytes(ciphertextB64);
  const iv = base64ToBytes(ivB64);
  const encapPublicKey = await crypto.subtle.importKey(
    'spki',
    new Uint8Array(base64ToBytes(encapPublicKeyB64)),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: encapPublicKey },
    recipientPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const plaintextBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    aesKey,
    new Uint8Array(ciphertext)
  );

  return dec.decode(plaintextBuf);
}

export function saveUserHpkeBundle(
  username: string,
  bundle: { privateKeyJwkB64: string; publicKeyB64: string }
) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(userHpkeKey(username), JSON.stringify(bundle));
}

export function getUserHpkeBundle(username: string): {
  privateKeyJwkB64: string;
  publicKeyB64: string;
} | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(userHpkeKey(username));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      privateKeyJwkB64?: string;
      publicKeyB64?: string;
    };
    if (!parsed.privateKeyJwkB64 || !parsed.publicKeyB64) return null;
    return {
      privateKeyJwkB64: parsed.privateKeyJwkB64,
      publicKeyB64: parsed.publicKeyB64,
    };
  } catch {
    return null;
  }
}

export function setActiveHpkePrivateKey(privateKeyJwkB64: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(ACTIVE_HPKE_PRIVATE_KEY, privateKeyJwkB64);
}

export function setActiveHpkePublicKey(publicKeyB64: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(ACTIVE_HPKE_PUBLIC_KEY, publicKeyB64);
}

export function getActiveHpkePrivateKeyJwkB64(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ACTIVE_HPKE_PRIVATE_KEY);
}

export function getActiveHpkePublicKeyB64(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ACTIVE_HPKE_PUBLIC_KEY);
}
