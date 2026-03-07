import { useMutation } from '@tanstack/react-query';
import { useTRPC } from './TrpcContext';
import { Shop, type User } from './useUserContext';
import { useCallback } from 'react';
import { FormValues } from '@/components/authentication/types';
import { startAuthentication } from '@simplewebauthn/browser';
import {
  deleteActiveHpkeKey,
  deleteUserHpkeBundle,
  decryptPrivateKeyWithRecoveryKey,
  deriveRecoveryKey,
  encryptPrivateKeyWithRecoveryKey,
  encryptWithHpkePublicKey,
  exportHpkePrivateKeyJwkB64,
  exportHpkePublicKeyB64,
  generateHpkeKeyPair,
  getActiveHpkePrivateKeyJwkB64,
  getActiveHpkePublicKeyB64,
  getUserHpkeBundle,
  newRecoverySaltB64,
  saveUserHpkeBundle,
  setActiveHpkePrivateKey,
  setActiveHpkePublicKey,
} from '@/lib/encryption';
import { hashEmail } from '@/lib/emailHash';

export type SuccessData = {
  jwt: string;
};

type EncryptedAccessInput = {
  username: string;
  recoveryPassphrase?: string;
  hpkePublicKeyB64?: string | null;
  recoverySaltB64?: string | null;
  encryptedPrivateKey?: string | null;
  encryptedPrivateKeyIv?: string | null;
};

type EncryptedAccessResult = {
  hasAccess: boolean;
  message?: string;
};

export async function ensureEncryptedDataAccessForLogin({
  username,
  recoveryPassphrase,
  hpkePublicKeyB64,
  recoverySaltB64,
  encryptedPrivateKey,
  encryptedPrivateKeyIv,
}: EncryptedAccessInput): Promise<EncryptedAccessResult> {
  const storedBundle = await getUserHpkeBundle(username);

  if (
    storedBundle &&
    (!hpkePublicKeyB64 || storedBundle.publicKeyB64 === hpkePublicKeyB64)
  ) {
    await setActiveHpkePrivateKey(storedBundle.privateKeyJwkB64);
    await setActiveHpkePublicKey(storedBundle.publicKeyB64);
    return { hasAccess: true };
  }

  const hasRecoveryMaterial = Boolean(
    hpkePublicKeyB64 &&
      recoverySaltB64 &&
      encryptedPrivateKey &&
      encryptedPrivateKeyIv
  );

  if (!hasRecoveryMaterial) {
    if (storedBundle && hpkePublicKeyB64) {
      await deleteUserHpkeBundle(username);
      await deleteActiveHpkeKey();
    }
    return {
      hasAccess: false,
      message:
        'Login succeeded, but encrypted profile data is locked on this device. Sign in once with your recovery passphrase to restore access.',
    };
  }

  if (!recoveryPassphrase) {
    if (storedBundle && hpkePublicKeyB64) {
      await deleteUserHpkeBundle(username);
      await deleteActiveHpkeKey();
    }
    return {
      hasAccess: false,
      message:
        'Enter your recovery passphrase to unlock encrypted profile data on this device.',
    };
  }

  try {
    const recoveryKey = await deriveRecoveryKey(
      recoveryPassphrase,
      recoverySaltB64 as string
    );
    const privateKeyJwkB64 = await decryptPrivateKeyWithRecoveryKey(
      encryptedPrivateKey as string,
      encryptedPrivateKeyIv as string,
      recoveryKey
    );
    await saveUserHpkeBundle(username, {
      privateKeyJwkB64,
      publicKeyB64: hpkePublicKeyB64 as string,
    });
    await setActiveHpkePrivateKey(privateKeyJwkB64);
    await setActiveHpkePublicKey(hpkePublicKeyB64 as string);
    return { hasAccess: true };
  } catch {
    if (storedBundle && hpkePublicKeyB64) {
      await deleteUserHpkeBundle(username);
      await deleteActiveHpkeKey();
    }
    return {
      hasAccess: false,
      message:
        'Login succeeded, but encrypted profile data could not be unlocked. Verify your recovery passphrase and try again.',
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
    trpc.biometric.authenticate.mutationOptions({
      onError: (error) => {
        console.error('error', error);
      },
    })
  );
  const registerMutation = useMutation(
    trpc.biometric.register.mutationOptions({
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
      const emailHash = await hashEmail(values.email);

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
        const { bundle: hpkeBundle, hadStoredBundle } =
          await ensureActiveHpkeBundle(values.username);

        const result = await authenticateMutation.mutateAsync({
          username: values.username,
          password: values.password,
          hpkePublicKeyB64: hpkeBundle.publicKeyB64,
        });

        const serverHpkePublicKeyB64 = result.hpkePublicKeyB64 ?? null;
        const bundleMismatch = Boolean(
          serverHpkePublicKeyB64 &&
            hpkeBundle.publicKeyB64 !== serverHpkePublicKeyB64
        );
        const shouldRestoreFromRecovery = !hadStoredBundle || bundleMismatch;

        if (shouldRestoreFromRecovery) {
          const recoveryPassphraseToTry =
            values.recoveryPassphrase || values.password;
          if (
            recoveryPassphraseToTry &&
            result.recoverySaltB64 &&
            result.encryptedPrivateKey &&
            result.encryptedPrivateKeyIv &&
            serverHpkePublicKeyB64
          ) {
            try {
              const recoveryKey = await deriveRecoveryKey(
                recoveryPassphraseToTry,
                result.recoverySaltB64
              );
              const privateKeyJwkB64 = await decryptPrivateKeyWithRecoveryKey(
                result.encryptedPrivateKey,
                result.encryptedPrivateKeyIv,
                recoveryKey
              );
              await saveUserHpkeBundle(values.username, {
                privateKeyJwkB64,
                publicKeyB64: serverHpkePublicKeyB64,
              });
              await setActiveHpkePrivateKey(privateKeyJwkB64);
              await setActiveHpkePublicKey(serverHpkePublicKeyB64);
            } catch {
              if (bundleMismatch) {
                await deleteUserHpkeBundle(values.username);
                await deleteActiveHpkeKey();
              }
              setMessage({
                message:
                  'Login succeeded, but encrypted profile data is still locked on this device. Enter your recovery passphrase to restore your key.',
                type: 'error',
              });
            }
          } else {
            if (bundleMismatch) {
              await deleteUserHpkeBundle(values.username);
              await deleteActiveHpkeKey();
            }
            setMessage({
              message:
                'Login succeeded, but private profile data is locked on this device. Enter recovery passphrase to restore your key.',
              type: 'error',
            });
          }
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
      const attResp = await startAuthentication({
        optionsJSON: options,
      });

      const result = await verifyAuthenticationMutation.mutateAsync(attResp);

      if (!result?.verified || !result?.jwt) {
        throw new Error('Passwordless verification failed');
      }

      const encryptedAccess = await ensureEncryptedDataAccess({
        username,
        recoveryPassphrase,
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
      verifyAuthenticationMutation.isPending,
  };
}
