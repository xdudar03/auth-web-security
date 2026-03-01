import { createHash, webcrypto } from "node:crypto";
import bcrypt from "bcryptjs";
import type { User, UserPrivateData } from "../types/user.ts";

const HPKE_INFO = "auth-web-security:hpke-v1";
const RECOVERY_KEY_ITERATIONS = 310000;
const encoder = new TextEncoder();

type SeedEncryptedUserInput = {
  userId: string;
  username: string;
  email: string;
  password: string;
  roleId: number;
  privacyPreset?: string;
  isBiometric?: boolean;
  recoveryPassphrase?: string;
  privateProfile: Record<string, unknown>;
  anonymizedPrivateProfile?: Record<string, unknown>;
};

type Envelope = {
  ciphertextB64: string;
  ivB64: string;
  encapPublicKeyB64: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().normalize("NFKC");
}

export function hashEmailForSeed(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

async function deriveRecoveryKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const keyMaterial = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return webcrypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: RECOVERY_KEY_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptPrivateKeyWithRecoveryKey(
  privateKeyJwkB64: string,
  recoveryPassphrase: string,
): Promise<{
  recoverySaltB64: string;
  encryptedPrivateKey: string;
  encryptedPrivateKeyIv: string;
}> {
  const recoverySalt = webcrypto.getRandomValues(new Uint8Array(16));
  const recoveryIv = webcrypto.getRandomValues(new Uint8Array(12));
  const recoveryKey = await deriveRecoveryKey(recoveryPassphrase, recoverySalt);

  const encryptedPrivateKeyRaw = await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv: recoveryIv },
    recoveryKey,
    encoder.encode(privateKeyJwkB64),
  );

  return {
    recoverySaltB64: bytesToBase64(recoverySalt),
    encryptedPrivateKey: bytesToBase64(new Uint8Array(encryptedPrivateKeyRaw)),
    encryptedPrivateKeyIv: bytesToBase64(recoveryIv),
  };
}

async function deriveContentKeyFromEcdh(
  senderPrivateKey: CryptoKey,
  recipientPublicKey: CryptoKey,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const sharedBits = await webcrypto.subtle.deriveBits(
    { name: "ECDH", public: recipientPublicKey },
    senderPrivateKey,
    256,
  );
  const keyMaterial = await webcrypto.subtle.importKey(
    "raw",
    sharedBits,
    "HKDF",
    false,
    ["deriveKey"],
  );
  return webcrypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info: encoder.encode(HPKE_INFO),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptForUser(
  recipientPublicKey: CryptoKey,
  plaintext: string,
): Promise<Envelope> {
  const ephemeralPair = (await webcrypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  )) as CryptoKeyPair;
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const contentKey = await deriveContentKeyFromEcdh(
    ephemeralPair.privateKey,
    recipientPublicKey,
    iv,
  );
  const ciphertext = await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    contentKey,
    encoder.encode(plaintext),
  );
  const encapPublicSpki = await webcrypto.subtle.exportKey(
    "spki",
    ephemeralPair.publicKey,
  );

  return {
    ciphertextB64: bytesToBase64(new Uint8Array(ciphertext)),
    ivB64: bytesToBase64(iv),
    encapPublicKeyB64: bytesToBase64(new Uint8Array(encapPublicSpki)),
  };
}

async function importEcdhPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  return webcrypto.subtle.importKey(
    "spki",
    base64ToBytes(publicKeyB64),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
}

export async function encryptForProviderSeedShare(
  providerPublicKeyB64: string,
  payload: Record<string, unknown>,
): Promise<{
  providerPublicKeyHash: string;
  userCipher: string;
  userIv: string;
  userEncapPubKey: string;
}> {
  const providerPublicKey = await importEcdhPublicKey(providerPublicKeyB64);
  const envelope = await encryptForUser(providerPublicKey, JSON.stringify(payload));

  const providerPublicKeyHashRaw = await webcrypto.subtle.digest(
    "SHA-256",
    base64ToBytes(providerPublicKeyB64),
  );

  return {
    providerPublicKeyHash: bytesToBase64(new Uint8Array(providerPublicKeyHashRaw)),
    userCipher: envelope.ciphertextB64,
    userIv: envelope.ivB64,
    userEncapPubKey: envelope.encapPublicKeyB64,
  };
}

export async function buildEncryptedSeedUser(
  input: SeedEncryptedUserInput,
): Promise<{ user: User; privateData: UserPrivateData }> {
  const {
    userId,
    username,
    email,
    password,
    roleId,
    privacyPreset,
    isBiometric = false,
    recoveryPassphrase = password,
    privateProfile,
    anonymizedPrivateProfile,
  } = input;

  const passwordSalt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, passwordSalt);

  const userKeyPair = (await webcrypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  )) as CryptoKeyPair;

  const hpkePublicSpki = await webcrypto.subtle.exportKey(
    "spki",
    userKeyPair.publicKey,
  );
  const hpkePublicKeyB64 = bytesToBase64(new Uint8Array(hpkePublicSpki));

  const privateJwk = await webcrypto.subtle.exportKey("jwk", userKeyPair.privateKey);
  const privateKeyJwkB64 = bytesToBase64(
    encoder.encode(JSON.stringify(privateJwk)),
  );

  const encryptedPrivateKeyMaterial = await encryptPrivateKeyWithRecoveryKey(
    privateKeyJwkB64,
    recoveryPassphrase,
  );

  const originalEnvelope = await encryptForUser(
    userKeyPair.publicKey,
    JSON.stringify(privateProfile),
  );

  const anonymizedEnvelope = anonymizedPrivateProfile
    ? await encryptForUser(userKeyPair.publicKey, JSON.stringify(anonymizedPrivateProfile))
    : null;

  return {
    user: {
      userId,
      username,
      password: hashedPassword,
      roleId,
      isBiometric,
      privacyPreset: privacyPreset ?? null,
      emailHash: hashEmailForSeed(email),
      hpkePublicKeyB64,
      recoverySaltB64: encryptedPrivateKeyMaterial.recoverySaltB64,
      encryptedPrivateKey: encryptedPrivateKeyMaterial.encryptedPrivateKey,
      encryptedPrivateKeyIv: encryptedPrivateKeyMaterial.encryptedPrivateKeyIv,
    },
    privateData: {
      userId,
      original_cipher: originalEnvelope.ciphertextB64,
      original_iv: originalEnvelope.ivB64,
      original_encap_pubkey: originalEnvelope.encapPublicKeyB64,
      anonymized_cipher: anonymizedEnvelope?.ciphertextB64,
      anonymized_iv: anonymizedEnvelope?.ivB64,
      anonymized_encap_pubkey: anonymizedEnvelope?.encapPublicKeyB64,
    },
  };
}
