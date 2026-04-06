import { useMutation } from '@tanstack/react-query';
import { useTRPC } from './TrpcContext';
import { Shop, type User } from './useUserContext';
import { useCallback } from 'react';
import { FormValues } from '@/types/authentication';
import { startAuthentication } from '@simplewebauthn/browser';
import {
  decryptPrivateKeyWithPasskeyPrfOutput,
  decryptPrivateKeyWithRecoveryKey,
  deriveRecoveryKey,
  encryptPrivateKeyWithPasskeyPrfOutput,
  encryptPrivateKeyWithRecoveryKey,
  encryptWithHpkePublicKey,
  extractPasskeyPrfOutputB64,
  exportHpkePrivateKeyJwkB64,
  exportHpkePublicKeyB64,
  generateHpkeKeyPair,
  getActiveHpkePrivateKeyJwkB64,
  getActiveHpkePublicKeyB64,
  getUserHpkeBundle,
  getUserHpkeBundleByPublicKey,
  newRecoverySaltB64,
  saveUserHpkeBundle,
  setActiveHpkePrivateKey,
  setActiveHpkePublicKey,
} from '@/lib/encryption/encryption';
import { hashString } from '@/lib/encryption/hash';

export type SuccessData = {
  jwt: string;
};

const PASSKEY_PRF_EVAL_LABEL = 'auth-web-security:hpke-unlock-v1';
const AUTH_TIMING_LOGS_ENABLED =
  process.env.NEXT_PUBLIC_BIOMETRIC_TIMING_LOGS !== 'false';

const authTimingMs = (startedAt: number) =>
  Math.round((performance.now() - startedAt) * 100) / 100;

const logAuthTiming = (event: string, metrics: Record<string, unknown>) => {
  if (!AUTH_TIMING_LOGS_ENABLED) return;
  const payload = Object.entries(metrics)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
  console.info(`[timing][${event}] ${payload}`.trim());
};

type EncryptedAccessInput = {
  username: string;
  recoveryPassphrase?: string;
  passkeyPrfOutputB64?: string;
  passkeyCredentialId?: string | null;
  passkeyWrappedPrivateKey?: string | null;
  passkeyWrappedPrivateKeyIv?: string | null;
  passkeyWrapSaltB64?: string | null;
  hpkePublicKeyB64?: string | null;
  recoverySaltB64?: string | null;
  encryptedPrivateKey?: string | null;
  encryptedPrivateKeyIv?: string | null;
};

type EncryptedAccessResult = {
  hasAccess: boolean;
  message?: string;
};

const FIRST_LOGIN_RECOVERY_MESSAGE =
  'For first login on a new device, enter your recovery passphrase once to unlock encrypted profile data.';

export async function ensureEncryptedDataAccessForLogin({
  username,
  recoveryPassphrase,
  passkeyPrfOutputB64,
  passkeyCredentialId,
  passkeyWrappedPrivateKey,
  passkeyWrappedPrivateKeyIv,
  passkeyWrapSaltB64,
  hpkePublicKeyB64,
  recoverySaltB64,
  encryptedPrivateKey,
  encryptedPrivateKeyIv,
}: EncryptedAccessInput): Promise<EncryptedAccessResult> {
  const totalStartedAt = performance.now();
  const bundleLookupStartedAt = performance.now();
  let storedBundle = await getUserHpkeBundle(username);
  let bundleLookupMs = authTimingMs(bundleLookupStartedAt);

  if (!storedBundle && hpkePublicKeyB64) {
    const publicKeyMatchStartedAt = performance.now();
    const matchedBundle = await getUserHpkeBundleByPublicKey(hpkePublicKeyB64);
    const publicKeyMatchMs = authTimingMs(publicKeyMatchStartedAt);
    if (matchedBundle) {
      await saveUserHpkeBundle(username, matchedBundle);
      storedBundle = matchedBundle;
    }
    bundleLookupMs += publicKeyMatchMs;
  }

  if (
    storedBundle &&
    (!hpkePublicKeyB64 || storedBundle.publicKeyB64 === hpkePublicKeyB64)
  ) {
    const activateStoredStartedAt = performance.now();
    await setActiveHpkePrivateKey(storedBundle.privateKeyJwkB64);
    await setActiveHpkePublicKey(storedBundle.publicKeyB64);
    logAuthTiming('ensure_encrypted_access', {
      username,
      path: 'stored_bundle',
      bundle_lookup_ms: bundleLookupMs,
      activate_ms: authTimingMs(activateStoredStartedAt),
      total_ms: authTimingMs(totalStartedAt),
    });
    return { hasAccess: true };
  }

  const hasPasskeyWrappedMaterial = Boolean(
    passkeyPrfOutputB64 &&
    passkeyWrappedPrivateKey &&
    passkeyWrappedPrivateKeyIv &&
    passkeyWrapSaltB64 &&
    hpkePublicKeyB64
  );

  if (hasPasskeyWrappedMaterial) {
    try {
      const passkeyUnwrapStartedAt = performance.now();
      const privateKeyJwkB64 = await decryptPrivateKeyWithPasskeyPrfOutput(
        passkeyWrappedPrivateKey as string,
        passkeyWrappedPrivateKeyIv as string,
        passkeyWrapSaltB64 as string,
        passkeyPrfOutputB64 as string
      );
      await saveUserHpkeBundle(username, {
        privateKeyJwkB64,
        publicKeyB64: hpkePublicKeyB64 as string,
      });
      await setActiveHpkePrivateKey(privateKeyJwkB64);
      await setActiveHpkePublicKey(hpkePublicKeyB64 as string);
      logAuthTiming('ensure_encrypted_access', {
        username,
        path: 'passkey_unwrap',
        bundle_lookup_ms: bundleLookupMs,
        passkey_unwrap_ms: authTimingMs(passkeyUnwrapStartedAt),
        total_ms: authTimingMs(totalStartedAt),
      });
      return { hasAccess: true };
    } catch {
      console.warn(
        'Passkey private-key unwrap failed for credential',
        passkeyCredentialId
      );
    }
  }

  const hasRecoveryMaterial = Boolean(
    hpkePublicKeyB64 &&
    recoverySaltB64 &&
    encryptedPrivateKey &&
    encryptedPrivateKeyIv
  );

  if (!hasRecoveryMaterial) {
    logAuthTiming('ensure_encrypted_access', {
      username,
      path: 'missing_recovery_material',
      bundle_lookup_ms: bundleLookupMs,
      total_ms: authTimingMs(totalStartedAt),
    });
    return {
      hasAccess: false,
      message: `Login succeeded, but encrypted profile data is locked on this device. ${FIRST_LOGIN_RECOVERY_MESSAGE}`,
    };
  }

  if (!recoveryPassphrase) {
    logAuthTiming('ensure_encrypted_access', {
      username,
      path: 'missing_recovery_passphrase',
      bundle_lookup_ms: bundleLookupMs,
      total_ms: authTimingMs(totalStartedAt),
    });
    return {
      hasAccess: false,
      message: FIRST_LOGIN_RECOVERY_MESSAGE,
    };
  }

  try {
    const recoveryUnlockStartedAt = performance.now();
    const recoveryKey = await deriveRecoveryKey(
      recoveryPassphrase,
      recoverySaltB64 as string
    );
    const deriveRecoveryMs = authTimingMs(recoveryUnlockStartedAt);
    const decryptStartedAt = performance.now();
    const privateKeyJwkB64 = await decryptPrivateKeyWithRecoveryKey(
      encryptedPrivateKey as string,
      encryptedPrivateKeyIv as string,
      recoveryKey
    );
    const decryptRecoveryMs = authTimingMs(decryptStartedAt);
    const activateStartedAt = performance.now();
    await saveUserHpkeBundle(username, {
      privateKeyJwkB64,
      publicKeyB64: hpkePublicKeyB64 as string,
    });
    await setActiveHpkePrivateKey(privateKeyJwkB64);
    await setActiveHpkePublicKey(hpkePublicKeyB64 as string);
    logAuthTiming('ensure_encrypted_access', {
      username,
      path: 'recovery_unlock',
      bundle_lookup_ms: bundleLookupMs,
      derive_recovery_ms: deriveRecoveryMs,
      decrypt_recovery_ms: decryptRecoveryMs,
      activate_ms: authTimingMs(activateStartedAt),
      total_ms: authTimingMs(totalStartedAt),
    });
    return { hasAccess: true };
  } catch {
    logAuthTiming('ensure_encrypted_access', {
      username,
      path: 'recovery_unlock_failed',
      bundle_lookup_ms: bundleLookupMs,
      total_ms: authTimingMs(totalStartedAt),
    });
    return {
      hasAccess: false,
      message: `Login succeeded, but encrypted profile data could not be unlocked. ${FIRST_LOGIN_RECOVERY_MESSAGE}`,
    };
  }
}

export default function useAuth({
  handleSuccess,
  allShops,
  user,
  title,
  setMessage,
}: {
  handleSuccess: (data: SuccessData) => void;
  allShops: Shop[];
  user: User;
  title: string;
  setMessage: (message: { message: string; type: 'success' | 'error' }) => void;
}) {
  const trpc = useTRPC();
  const authenticateMutation = useMutation(
    trpc.user.authenticate.mutationOptions({
      onError: (error) => {
        console.error('error', error);
      },
    })
  );
  const registerMutation = useMutation(
    trpc.user.register.mutationOptions({
      onSuccess: () => {
        setMessage({
          message: 'Please check your email for confirmation',
          type: 'success',
        });
      },
      onError: (error) => {
        setMessage({
          message: `Failed to register user: ${error.message}`,
          type: 'error',
        });
      },
    })
  );
  const getAuthenticationOptionsMutation = useMutation(
    trpc.passwordless.getAuthenticationOptions.mutationOptions({
      onError: (error) => {
        console.error('error', error);
        setMessage({
          message: 'Failed to get authentication options',
          type: 'error',
        });
      },
    })
  );
  const verifyAuthenticationMutation = useMutation(
    trpc.passwordless.verifyAuthentication.mutationOptions({
      onError: (error) => {
        console.error('error', error);
        setMessage({
          message: 'Failed to verify authentication',
          type: 'error',
        });
      },
    })
  );
  const saveCredentialKeyMaterialMutation = useMutation(
    trpc.passwordless.saveCredentialKeyMaterial.mutationOptions({
      onError: (error) => {
        console.error('Failed to save passkey key material', error);
      },
    })
  );

  const ensureActiveHpkeBundle = useCallback(async (username: string) => {
    const existing = await getUserHpkeBundle(username);
    if (existing) {
      const activePrivate = await getActiveHpkePrivateKeyJwkB64();
      const activePublic = await getActiveHpkePublicKeyB64();
      if (
        !activePrivate ||
        !activePublic ||
        activePrivate !== existing.privateKeyJwkB64 ||
        activePublic !== existing.publicKeyB64
      ) {
        await setActiveHpkePrivateKey(existing.privateKeyJwkB64);
        await setActiveHpkePublicKey(existing.publicKeyB64);
      }
      return {
        bundle: existing,
        hadStoredBundle: true,
      };
    }

    const pair = await generateHpkeKeyPair();
    const regeneratedBundle = {
      privateKeyJwkB64: await exportHpkePrivateKeyJwkB64(pair.privateKey),
      publicKeyB64: await exportHpkePublicKeyB64(pair.publicKey),
    };
    await saveUserHpkeBundle(username, regeneratedBundle);
    await setActiveHpkePrivateKey(regeneratedBundle.privateKeyJwkB64);
    await setActiveHpkePublicKey(regeneratedBundle.publicKeyB64);

    return {
      bundle: regeneratedBundle,
      hadStoredBundle: false,
    };
  }, []);
  const sendConfirmationEmailMutation = useMutation(
    trpc.email.sendConfirmationEmail.mutationOptions({
      onSuccess: (data) => {
        console.log('data', data);
      },
      onError: (error) => {
        console.error('error', error);
        setMessage({
          message: 'Failed to send confirmation email',
          type: 'error',
        });
      },
    })
  );

  const ensureEncryptedDataAccess = useCallback(
    async (input: EncryptedAccessInput): Promise<EncryptedAccessResult> =>
      ensureEncryptedDataAccessForLogin(input),
    []
  );

  const loadShops = useCallback(
    async (inputValue: string): Promise<{ label: string; value: number }[]> => {
      try {
        // Simulate API call delay for demo
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Filter shops based on input value (case insensitive)
        const filteredShops = allShops.filter((shop: Shop) =>
          shop.shopName.toLowerCase().includes(inputValue.toLowerCase())
        );

        return filteredShops.map((shop: Shop) => ({
          label: shop.shopName,
          value: shop.shopId,
        }));
      } catch (error) {
        console.error('Error loading shops:', error);
        return [];
      }
    },
    [allShops]
  );
  const handleAuthenticate = async (values: FormValues) => {
    console.log('submitting users', { ...user, ...values });
    if (title === 'Registration') {
      if (
        registerMutation.isPending ||
        sendConfirmationEmailMutation.isPending
      ) {
        setMessage({
          message: 'Please wait for the previous request to complete',
          type: 'error',
        });
        return;
      }
      const id = crypto.randomUUID(); // TODO: generate id from server

      const hpkePair = await generateHpkeKeyPair();
      const hpkePublicKeyB64 = await exportHpkePublicKeyB64(hpkePair.publicKey);
      const hpkePrivateKeyJwkB64 = await exportHpkePrivateKeyJwkB64(
        hpkePair.privateKey
      );
      const recoverySaltB64 = newRecoverySaltB64();
      const recoveryKey = await deriveRecoveryKey(
        values.recoveryPassphrase,
        recoverySaltB64
      );
      const encryptedPrivateKey = await encryptPrivateKeyWithRecoveryKey(
        hpkePrivateKeyJwkB64,
        recoveryKey
      );
      await saveUserHpkeBundle(values.username, {
        privateKeyJwkB64: hpkePrivateKeyJwkB64,
        publicKeyB64: hpkePublicKeyB64,
      });
      await setActiveHpkePrivateKey(hpkePrivateKeyJwkB64);
      await setActiveHpkePublicKey(hpkePublicKeyB64);

      const encryptedData = await encryptWithHpkePublicKey(
        hpkePublicKeyB64,
        JSON.stringify({
          email: values.email,
          username: values.username,
        })
      );
      const emailHash = await hashString(values.email);

      const result = await registerMutation.mutateAsync({
        username: values.username,
        emailHash,
        hpkePublicKeyB64,
        recoverySaltB64,
        encryptedPrivateKey: encryptedPrivateKey.ciphertextB64,
        encryptedPrivateKeyIv: encryptedPrivateKey.ivB64,
        password: values.password,
        userId: id,
        roleId: 2,
        shopIds: values.shopIds,
        privateData: {
          original_cipher: encryptedData.ciphertextB64,
          original_iv: encryptedData.ivB64,
          original_encap_pubkey: encryptedData.encapPublicKeyB64,
        },
      });
      console.log('result', result);
      if (!result) {
        setMessage({
          message: 'Failed to register user',
          type: 'error',
        });
        return;
      }
      const email = await sendConfirmationEmailMutation.mutateAsync({
        to: values.email,
        userId: id,
      });
      console.log('email', email);
      if (!email) {
        setMessage({
          message: 'Failed to send confirmation email',
          type: 'error',
        });
        return;
      }
    } else {
      if (authenticateMutation.isPending) {
        setMessage({
          message: 'Please wait for the previous request to complete',
          type: 'error',
        });
        return;
      }
      try {
        const { bundle: hpkeBundle } = await ensureActiveHpkeBundle(
          values.username
        );

        const result = await authenticateMutation.mutateAsync({
          username: values.username,
          password: values.password,
          hpkePublicKeyB64: hpkeBundle.publicKeyB64,
        });

        const encryptedAccess = await ensureEncryptedDataAccess({
          username: values.username,
          recoveryPassphrase: values.recoveryPassphrase || values.password,
          hpkePublicKeyB64: result.hpkePublicKeyB64 ?? null,
          recoverySaltB64: result.recoverySaltB64 ?? null,
          encryptedPrivateKey: result.encryptedPrivateKey ?? null,
          encryptedPrivateKeyIv: result.encryptedPrivateKeyIv ?? null,
        });

        if (!encryptedAccess.hasAccess) {
          setMessage({
            message:
              encryptedAccess.message ??
              'Encrypted profile data is locked on this device.',
            type: 'error',
          });
        }

        handleSuccess({ jwt: result.jwt });
      } catch {
        setMessage({
          message: 'Login failed',
          type: 'error',
        });
      }
    }
  };
  const handlePasswordless = async (
    username: string,
    recoveryPassphrase?: string
  ) => {
    try {
      if (
        getAuthenticationOptionsMutation.isPending ||
        verifyAuthenticationMutation.isPending
      ) {
        setMessage({
          message: 'Please wait for the previous request to complete',
          type: 'error',
        });
        return;
      }
      const options = await getAuthenticationOptionsMutation.mutateAsync({
        username,
      });
      const prfInput = new TextEncoder().encode(PASSKEY_PRF_EVAL_LABEL);
      const optionsWithPrf = {
        ...options,
        extensions: {
          ...(options.extensions ?? {}),
          // WebAuthn expects BufferSource here, not JSON strings.
          prf: { eval: { first: prfInput } },
        },
      } as typeof options & {
        extensions: Record<string, unknown>;
      };

      let attResp;
      try {
        attResp = await startAuthentication({
          optionsJSON: optionsWithPrf,
        });
      } catch (error) {
        const isPrfExtensionError =
          error instanceof TypeError &&
          /extensions|prf|BufferSource|ArrayBuffer|evalByCredential/i.test(
            String(error.message ?? '')
          );
        if (!isPrfExtensionError) {
          throw error;
        }
        // Graceful fallback for browsers/authenticators that reject PRF inputs.
        attResp = await startAuthentication({
          optionsJSON: options,
        });
      }
      const passkeyPrfOutputB64 = extractPasskeyPrfOutputB64(
        attResp.clientExtensionResults
      );

      const result = await verifyAuthenticationMutation.mutateAsync(attResp);

      if (!result?.verified || !result?.jwt) {
        throw new Error('Passwordless verification failed');
      }

      const encryptedAccess = await ensureEncryptedDataAccess({
        username,
        recoveryPassphrase,
        passkeyPrfOutputB64: passkeyPrfOutputB64 ?? undefined,
        passkeyCredentialId: result.credentialId ?? attResp.id ?? null,
        passkeyWrappedPrivateKey: result.passkeyWrappedPrivateKey ?? null,
        passkeyWrappedPrivateKeyIv: result.passkeyWrappedPrivateKeyIv ?? null,
        passkeyWrapSaltB64: result.passkeyWrapSaltB64 ?? null,
        hpkePublicKeyB64: result.hpkePublicKeyB64 ?? null,
        recoverySaltB64: result.recoverySaltB64 ?? null,
        encryptedPrivateKey: result.encryptedPrivateKey ?? null,
        encryptedPrivateKeyIv: result.encryptedPrivateKeyIv ?? null,
      });

      if (
        encryptedAccess.hasAccess &&
        passkeyPrfOutputB64 &&
        result.credentialId
      ) {
        const activePrivateKeyJwkB64 = await getActiveHpkePrivateKeyJwkB64();
        if (activePrivateKeyJwkB64) {
          const wrappedPrivateKey = await encryptPrivateKeyWithPasskeyPrfOutput(
            activePrivateKeyJwkB64,
            passkeyPrfOutputB64
          );
          await saveCredentialKeyMaterialMutation.mutateAsync({
            credentialId: result.credentialId,
            wrappedPrivateKey: wrappedPrivateKey.ciphertextB64,
            wrappedPrivateKeyIv: wrappedPrivateKey.ivB64,
            wrapSaltB64: wrappedPrivateKey.saltB64,
          });
        }
      }

      if (!encryptedAccess.hasAccess) {
        setMessage({
          message:
            encryptedAccess.message ??
            'Encrypted profile data is locked on this device.',
          type: 'error',
        });
      }

      handleSuccess({ jwt: result.jwt });
    } catch (error) {
      console.error('Passwordless authentication failed', error);
      setMessage({
        message: 'Passwordless authentication failed',
        type: 'error',
      });
    }
  };

  return {
    handleAuthenticate,
    handlePasswordless,
    ensureEncryptedDataAccess,
    loadShops,
    isRegistering: registerMutation.isPending,
    isAuthenticating:
      authenticateMutation.isPending ||
      getAuthenticationOptionsMutation.isPending ||
      verifyAuthenticationMutation.isPending ||
      saveCredentialKeyMaterialMutation.isPending,
  };
}
