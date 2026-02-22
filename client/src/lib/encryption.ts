// crypto.ts
const enc = new TextEncoder();
const dec = new TextDecoder();

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

// 1) DATA KEY (DEK) creation
export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // true so it can be wrapped
    ['encrypt', 'decrypt']
  );
}

// 2) Encrypt/decrypt actual user payload with DEK
export async function encryptWithDek(
  dek: CryptoKey,
  plaintext: string
): Promise<{ ciphertextB64: string; ivB64: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    dek,
    enc.encode(plaintext)
  );

  return {
    ciphertextB64: bytesToBase64(new Uint8Array(ciphertext)),
    ivB64: bytesToBase64(iv),
  };
}

export async function decryptWithDek(
  dek: CryptoKey,
  ciphertextB64: string,
  ivB64: string
): Promise<string> {
  const ciphertext = base64ToBytes(ciphertextB64);
  const iv = base64ToBytes(ivB64);

  const plaintextBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    dek,
    new Uint8Array(ciphertext)
  );

  return dec.decode(plaintextBuf);
}

// 3) Derive KEK from password
export async function deriveKekFromPassword(
  password: string,
  saltB64: string,
  iterations = 310_000
): Promise<CryptoKey> {
  const salt = base64ToBytes(saltB64);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

export function newSaltB64(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
}

// 4) Wrap/unwrap DEK with KEK (for server storage)
export async function wrapDek(
  dek: CryptoKey,
  kek: CryptoKey
): Promise<{ wrappedDekB64: string; wrapIvB64: string }> {
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.wrapKey('raw', dek, kek, {
    name: 'AES-GCM',
    iv: wrapIv,
  });

  return {
    wrappedDekB64: bytesToBase64(new Uint8Array(wrapped)),
    wrapIvB64: bytesToBase64(wrapIv),
  };
}

export async function unwrapDek(
  wrappedDekB64: string,
  wrapIvB64: string,
  kek: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    new Uint8Array(base64ToBytes(wrappedDekB64)),
    kek,
    { name: 'AES-GCM', iv: new Uint8Array(base64ToBytes(wrapIvB64)) },
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function exportRawKeyB64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return bytesToBase64(new Uint8Array(raw));
}

export async function importRawAesKey(rawKeyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new Uint8Array(base64ToBytes(rawKeyB64)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}
