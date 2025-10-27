import { useMutation } from '@tanstack/react-query';
import { useTRPC } from './TrpcContext';
import { Shop, type Role, type User } from './useUserContext';
import { useCallback } from 'react';
import { FormValues } from '@/components/authentication/FormAuth';
import { startAuthentication } from '@simplewebauthn/browser';

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
      onSuccess: (data: { jwt: string }) => {
        console.log('data', data);
        handleSuccess({ jwt: data.jwt });
      },
      onError: (error) => {
        console.error('error', error);
      },
    })
  );
  const registerMutation = useMutation(
    trpc.biometric.register.mutationOptions({
      onSuccess: (data: SuccessData) => {
        console.log('data', data);
        setMessage({
          message: 'Please check your email for confirmation',
          type: 'success',
        });
      },
      onError: (error) => {
        console.error('error', error);
        setMessage({
          message: 'Failed to register user',
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
      console.log('id', id);
      const result = await registerMutation.mutateAsync({
        username: values.username,
        email: values.email,
        password: values.password,
        userId: id,
        roleId: 2,
        shopIds: values.shopIds,
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
      authenticateMutation.mutate({
        username: values.username,
        password: values.password,
      });
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
