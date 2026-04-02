const enc = new TextEncoder();
const dec = new TextDecoder();

const ACTIVE_HPKE_PRIVATE_KEY = 'auth:active-hpke-private-jwk';
const ACTIVE_HPKE_PUBLIC_KEY = 'auth:active-hpke-public-key';
const USER_HPKE_PREFIX = 'auth:user-hpke:';
const HPKE_DB_NAME = 'auth-web-security-crypto';
const HPKE_DB_VERSION = 1;
const HPKE_BUNDLES_STORE = 'hpke-bundles';
const HPKE_ACTIVE_STORE = 'hpke-active';
const HPKE_ACTIVE_KEY = 'active';
const RECOVERY_KEY_ITERATIONS = 310000;
const HPKE_INFO = 'auth-web-security:hpke-v1';
const PASSKEY_WRAP_INFO = 'auth-web-security:passkey-wrap-v1';

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

function base64UrlToBytes(base64url: string): Uint8Array {
  const padded = `${base64url.replace(/-/g, '+').replace(/_/g, '/')}${'='.repeat((4 - (base64url.length % 4)) % 4)}`;
  return base64ToBytes(padded);
}

function toBytesFromUnknown(value: unknown): Uint8Array | null {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (
    typeof value === 'object' &&
    value !== null &&
    'buffer' in value &&
    (value as { buffer?: unknown }).buffer instanceof ArrayBuffer
  ) {
    return new Uint8Array((value as { buffer: ArrayBuffer }).buffer);
  }
  if (typeof value === 'string') {
    try {
      // Some browsers encode extension bytes as Base64URL strings.
      return base64UrlToBytes(value);
    } catch {
      return null;
    }
  }
  return null;
}

function userHpkeKey(username: string): string {
  return `${USER_HPKE_PREFIX}${username.trim().toLowerCase()}`;
}

export type HpkeBundle = { privateKeyJwkB64: string; publicKeyB64: string };

function openHpkeDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HPKE_DB_NAME, HPKE_DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HPKE_BUNDLES_STORE)) {
        db.createObjectStore(HPKE_BUNDLES_STORE);
      }
      if (!db.objectStoreNames.contains(HPKE_ACTIVE_STORE)) {
        db.createObjectStore(HPKE_ACTIVE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function getFromStore<T>(
  db: IDBDatabase,
  storeName: string,
  key: string
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () =>
      resolve((request.result as T | undefined) ?? null);
  });
}

function putInStore(
  db: IDBDatabase,
  storeName: string,
  key: string,
  value: unknown
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(value, key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function generateHpkeKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

export async function deriveRecoveryKey(
  passphrase: string,
  saltB64: string,
  iterations = RECOVERY_KEY_ITERATIONS
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(saltB64) as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function newRecoverySaltB64(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function encryptPrivateKeyWithRecoveryKey(
  privateKeyJwkB64: string,
  recoveryKey: CryptoKey
): Promise<{ ciphertextB64: string; ivB64: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    recoveryKey,
    enc.encode(privateKeyJwkB64)
  );
  return {
    ciphertextB64: bytesToBase64(new Uint8Array(ciphertext)),
    ivB64: bytesToBase64(iv),
  };
}

export async function decryptPrivateKeyWithRecoveryKey(
  ciphertextB64: string,
  ivB64: string,
  recoveryKey: CryptoKey
): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivB64) as BufferSource },
    recoveryKey,
    base64ToBytes(ciphertextB64) as BufferSource
  );
  return dec.decode(plaintext);
}

async function derivePasskeyWrapKey(
  passkeyPrfOutputB64: string,
  saltB64: string
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(passkeyPrfOutputB64) as BufferSource,
    'HKDF',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: base64ToBytes(saltB64) as BufferSource,
      info: enc.encode(PASSKEY_WRAP_INFO),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPrivateKeyWithPasskeyPrfOutput(
  privateKeyJwkB64: string,
  passkeyPrfOutputB64: string
): Promise<{ ciphertextB64: string; ivB64: string; saltB64: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const saltB64 = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
  const key = await derivePasskeyWrapKey(passkeyPrfOutputB64, saltB64);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(privateKeyJwkB64)
  );
  return {
    ciphertextB64: bytesToBase64(new Uint8Array(ciphertext)),
    ivB64: bytesToBase64(iv),
    saltB64,
  };
}

export async function decryptPrivateKeyWithPasskeyPrfOutput(
  ciphertextB64: string,
  ivB64: string,
  saltB64: string,
  passkeyPrfOutputB64: string
): Promise<string> {
  const key = await derivePasskeyWrapKey(passkeyPrfOutputB64, saltB64);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivB64) as BufferSource },
    key,
    base64ToBytes(ciphertextB64) as BufferSource
  );
  return dec.decode(plaintext);
}

export function extractPasskeyPrfOutputB64(
  clientExtensionResults: unknown
): string | null {
  const outputs = clientExtensionResults as {
    prf?: { results?: { first?: unknown } };
    hmacGetSecret?: { output1?: unknown };
  };

  const fromPrf = toBytesFromUnknown(outputs?.prf?.results?.first);
  if (fromPrf && fromPrf.length > 0) {
    return bytesToBase64(fromPrf);
  }

  // Legacy compat for devices exposing hmac-secret style output.
  const fromHmacSecret = toBytesFromUnknown(outputs?.hmacGetSecret?.output1);
  if (fromHmacSecret && fromHmacSecret.length > 0) {
    return bytesToBase64(fromHmacSecret);
  }

  return null;
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
    ['deriveKey', 'deriveBits']
  );
}

async function deriveContentKeyFromEcdh(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  salt: Uint8Array
): Promise<CryptoKey> {
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as BufferSource,
      info: enc.encode(HPKE_INFO),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
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
  // import the recipient public key for ecdh
  const recipientPublicKey = await crypto.subtle.importKey(
    'spki',
    new Uint8Array(base64ToBytes(recipientPublicKeyB64)),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  // generate a new ephemeral key pair for the sender
  const ephemeral = await generateHpkeKeyPair();
  // generate a random iv for the aes-gcm encryption
  const iv = crypto.getRandomValues(new Uint8Array(12));
  // derive the aes key from the ephemeral private key and the recipient public key
  const aesKey = await deriveContentKeyFromEcdh(
    ephemeral.privateKey,
    recipientPublicKey,
    iv
  );
  // encrypt the plaintext with the aes key and the iv
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    enc.encode(plaintext)
  );
  // export the ephemeral public key as a base64 string
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
  const aesKey = await deriveContentKeyFromEcdh(
    recipientPrivateKey,
    encapPublicKey,
    iv
  );

  const plaintextBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    aesKey,
    new Uint8Array(ciphertext)
  );

  return dec.decode(plaintextBuf);
}

export async function saveUserHpkeBundle(
  username: string,
  bundle: HpkeBundle
): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openHpkeDb();
  await putInStore(db, HPKE_BUNDLES_STORE, userHpkeKey(username), bundle);
}

export async function getUserHpkeBundle(
  username: string
): Promise<HpkeBundle | null> {
  if (typeof window === 'undefined') return null;
  const db = await openHpkeDb();
  const stored = await getFromStore<Partial<HpkeBundle>>(
    db,
    HPKE_BUNDLES_STORE,
    userHpkeKey(username)
  );
  if (!stored?.privateKeyJwkB64 || !stored.publicKeyB64) {
    return null;
  }
  return {
    privateKeyJwkB64: stored.privateKeyJwkB64,
    publicKeyB64: stored.publicKeyB64,
  };
}

export async function getUserHpkeBundleByPublicKey(
  publicKeyB64: string
): Promise<HpkeBundle | null> {
  if (typeof window === 'undefined') return null;
  const db = await openHpkeDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(HPKE_BUNDLES_STORE, 'readonly');
    const store = tx.objectStore(HPKE_BUNDLES_STORE);
    const request = store.openCursor();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(null);
        return;
      }

      const candidate = cursor.value as Partial<HpkeBundle> | undefined;
      if (
        candidate?.privateKeyJwkB64 &&
        candidate.publicKeyB64 === publicKeyB64
      ) {
        resolve({
          privateKeyJwkB64: candidate.privateKeyJwkB64,
          publicKeyB64: candidate.publicKeyB64,
        });
        return;
      }

      cursor.continue();
    };
  });
}

export async function setActiveHpkePrivateKey(
  privateKeyJwkB64: string
): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openHpkeDb();
  const active =
    (await getFromStore<Record<string, string>>(
      db,
      HPKE_ACTIVE_STORE,
      HPKE_ACTIVE_KEY
    )) ?? {};
  active[ACTIVE_HPKE_PRIVATE_KEY] = privateKeyJwkB64;
  await putInStore(db, HPKE_ACTIVE_STORE, HPKE_ACTIVE_KEY, active);
}

export async function setActiveHpkePublicKey(
  publicKeyB64: string
): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openHpkeDb();
  const active =
    (await getFromStore<Record<string, string>>(
      db,
      HPKE_ACTIVE_STORE,
      HPKE_ACTIVE_KEY
    )) ?? {};
  active[ACTIVE_HPKE_PUBLIC_KEY] = publicKeyB64;
  await putInStore(db, HPKE_ACTIVE_STORE, HPKE_ACTIVE_KEY, active);
}

export async function getActiveHpkePrivateKeyJwkB64(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const db = await openHpkeDb();
  const active = await getFromStore<Record<string, string>>(
    db,
    HPKE_ACTIVE_STORE,
    HPKE_ACTIVE_KEY
  );
  return active?.[ACTIVE_HPKE_PRIVATE_KEY] ?? null;
}

export async function getActiveHpkePublicKeyB64(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const db = await openHpkeDb();
  const active = await getFromStore<Record<string, string>>(
    db,
    HPKE_ACTIVE_STORE,
    HPKE_ACTIVE_KEY
  );
  return active?.[ACTIVE_HPKE_PUBLIC_KEY] ?? null;
}

function deleteFromStore(
  db: IDBDatabase,
  storeName: string,
  key: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

function clearStore(db: IDBDatabase, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deleteUserHpkeBundle(username: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openHpkeDb();
  await deleteFromStore(db, HPKE_BUNDLES_STORE, userHpkeKey(username));
}

export async function deleteActiveHpkeKey(): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openHpkeDb();
  await deleteFromStore(db, HPKE_ACTIVE_STORE, HPKE_ACTIVE_KEY);
}

export async function clearAllHpkeState(): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openHpkeDb();
  await Promise.all([
    clearStore(db, HPKE_BUNDLES_STORE),
    clearStore(db, HPKE_ACTIVE_STORE),
  ]);
}
