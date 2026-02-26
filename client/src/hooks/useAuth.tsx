import { useMutation } from '@tanstack/react-query';
import { useTRPC } from './TrpcContext';
import { Shop, type User } from './useUserContext';
import { useCallback } from 'react';
import { FormValues } from '@/components/authentication/types';
import { startAuthentication } from '@simplewebauthn/browser';
import { encryptWithDek, exportRawKeyB64, generateDek } from '@/lib/encryption';
import { hashEmail } from '@/lib/emailHash';

export type SuccessData = {
  jwt: string;
  dekB64?: string | null;
};

const DEK_SESSION_PREFIX = 'auth:session-dek:';

function getDekSessionKey(username: string) {
  return `${DEK_SESSION_PREFIX}${username.trim().toLowerCase()}`;
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
      onSuccess: (data: SuccessData) => {
        console.log('data', data);
        if (typeof window !== 'undefined') {
          Object.keys(sessionStorage)
            .filter((key) => key.startsWith(DEK_SESSION_PREFIX))
            .forEach((key) => sessionStorage.removeItem(key));
        }
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

  const ensureUserDekSession = useCallback(
    async (username: string, dekB64?: string | null) => {
      if (typeof window === 'undefined') return;

      const sessionKey = getDekSessionKey(username);

      if (dekB64) {
        sessionStorage.setItem(sessionKey, dekB64);
        return;
      }

      const currentDek = sessionStorage.getItem(sessionKey);
      if (currentDek) return;

      const dek = await generateDek();
      console.log('dek', dek);
      sessionStorage.setItem(sessionKey, await exportRawKeyB64(dek));
    },
    []
  );
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

      const generatedDek = await generateDek();
      const dekB64 = await exportRawKeyB64(generatedDek);

      const encryptedData = await encryptWithDek(
        generatedDek,
        JSON.stringify({
          email: values.email,
          username: values.username,
        })
      );
      const emailHash = await hashEmail(values.email);

      const result = await registerMutation.mutateAsync({
        username: values.username,
        emailHash,
        dekB64: dekB64,
        password: values.password,
        userId: id,
        roleId: 2,
        shopIds: values.shopIds,
        privateData: {
          original_cipher: encryptedData.ciphertextB64,
          original_iv: encryptedData.ivB64,
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
        const sessionKey = getDekSessionKey(values.username);
        let candidateDekB64: string | undefined;
        if (typeof window !== 'undefined') {
          candidateDekB64 = sessionStorage.getItem(sessionKey) ?? undefined;
          if (!candidateDekB64) {
            const generatedDek = await generateDek();
            candidateDekB64 = await exportRawKeyB64(generatedDek);
          }
        }

        const result = await authenticateMutation.mutateAsync({
          username: values.username,
          password: values.password,
          dekB64: candidateDekB64,
        });
        await ensureUserDekSession(
          values.username,
          result.dekB64 ?? candidateDekB64
        );
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
