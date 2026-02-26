import { useMutation } from '@tanstack/react-query';
import { useTRPC } from './TrpcContext';
import { Shop, type User } from './useUserContext';
import { useCallback } from 'react';
import { FormValues } from '@/components/authentication/types';
import { startAuthentication } from '@simplewebauthn/browser';
import {
  encryptWithHpkePublicKey,
  exportHpkePrivateKeyJwkB64,
  exportHpkePublicKeyB64,
  generateHpkeKeyPair,
  getUserHpkeBundle,
  saveUserHpkeBundle,
  setActiveHpkePrivateKey,
  setActiveHpkePublicKey,
} from '@/lib/encryption';
import { hashEmail } from '@/lib/emailHash';

export type SuccessData = {
  jwt: string;
};

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
      onSuccess: (data: SuccessData) => {
        console.log('data', data);
        handleSuccess(data);
      },
      onError: (error) => {
        console.error('error', error);
        setMessage({
          message: 'Failed to verify authentication',
          type: 'error',
        });
      },
    })
  );

  const ensureHpkeBundle = useCallback(async (username: string) => {
    const existing = getUserHpkeBundle(username);
    if (existing) {
      setActiveHpkePrivateKey(existing.privateKeyJwkB64);
      setActiveHpkePublicKey(existing.publicKeyB64);
      return existing;
    }

    const pair = await generateHpkeKeyPair();
    const publicKeyB64 = await exportHpkePublicKeyB64(pair.publicKey);
    const privateKeyJwkB64 = await exportHpkePrivateKeyJwkB64(pair.privateKey);
    const bundle = { privateKeyJwkB64, publicKeyB64 };
    saveUserHpkeBundle(username, bundle);
    setActiveHpkePrivateKey(bundle.privateKeyJwkB64);
    setActiveHpkePublicKey(bundle.publicKeyB64);
    return bundle;
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
      saveUserHpkeBundle(values.username, {
        privateKeyJwkB64: hpkePrivateKeyJwkB64,
        publicKeyB64: hpkePublicKeyB64,
      });
      setActiveHpkePrivateKey(hpkePrivateKeyJwkB64);
      setActiveHpkePublicKey(hpkePublicKeyB64);

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
        password: values.password,
        userId: id,
        roleId: 2,
        shopIds: values.shopIds,
        privateData: {
          original_cipher: encryptedData.ciphertextB64,
          original_iv: encryptedData.ivB64,
          original_aad: encryptedData.encapPublicKeyB64,
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
        const hpkeBundle = await ensureHpkeBundle(values.username);

        const result = await authenticateMutation.mutateAsync({
          username: values.username,
          password: values.password,
          hpkePublicKeyB64: hpkeBundle.publicKeyB64,
        });
        handleSuccess({ jwt: result.jwt });
      } catch {
        setMessage({
          message: 'Login failed',
          type: 'error',
        });
      }
    }
  };
  const handlePasswordless = async (username: string) => {
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

      await verifyAuthenticationMutation.mutateAsync(attResp);
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
    loadShops,
    isRegistering: registerMutation.isPending,
    isAuthenticating:
      authenticateMutation.isPending ||
      getAuthenticationOptionsMutation.isPending ||
      verifyAuthenticationMutation.isPending,
  };
}
