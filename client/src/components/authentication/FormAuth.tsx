'use client';
import { Shop, useUser, type User } from '@/hooks/useUserContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { useTRPC } from '@/hooks/TrpcContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useAuth from '@/hooks/useAuth';
import useJwt from '@/hooks/useJwt';
import type { FormValues } from './types';
import UsernameField from './UsernameField';
import PasswordField from './PasswordField';
import RegistrationFields from './RegistrationFields';
import TestAccountsDialog from './TestAccountsDialog';

export default function FormAuth({
  setTab,
  title,
}: {
  setTab: (tab: string) => void;
  title: string;
}) {
  const { user, role, isAuthenticated } = useUser();
  const { setJwt } = useJwt();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState({ message: '', type: '' });
  const listShopsQuery = useQuery(trpc.shops.getAllShops.queryOptions());
  const allShops = useMemo(
    () => listShopsQuery.data?.shops ?? [],
    [listShopsQuery.data?.shops]
  );
  const {
    handleAuthenticate,
    handlePasswordless,
    loadShops,
    isRegistering,
    isAuthenticating,
  } = useAuth({
    handleSuccess: handleSuccess,
    allShops: allShops as Shop[],
    user: user as User,
    title: title,
    setMessage: setMessage,
  });

  function handleSuccess({ jwt }: { jwt: string }) {
    // Clear cache before setting new token to avoid stale data from previous session
    queryClient.clear();
    setJwt(jwt);
  }

  const redirectToDashboard = useCallback(() => {
    console.log('redirecting to dashboard', role);
    if (role?.canAccessAdminPanel) {
      router.push('/admin-dashboard');
    } else if (role?.canAccessProviderPanel) {
      router.push('/provider-dashboard');
    } else {
      router.push('/dashboard');
    }
  }, [role, router]);

  // After JWT is set, wait for user info (including role) to load, then redirect
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!role) return;
    redirectToDashboard();
  }, [isAuthenticated, role, redirectToDashboard]);

  const form = useForm<FormValues>({
    defaultValues: {
      username: user?.username ?? '',
      password: user?.password ?? '',
      email: user?.email ?? '',
      shopIds: [],
    },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  // Initialize shopIds once when shops load on Registration
  const initializedShopsRef = useRef(false);
  useEffect(() => {
    if (title !== 'Registration') return;
    if (initializedShopsRef.current) return;
    if (!allShops || allShops.length === 0) return;
    form.setValue(
      'shopIds',
      allShops.map((shop: Shop) => shop.shopId),
      { shouldDirty: false, shouldTouch: false, shouldValidate: false }
    );
    initializedShopsRef.current = true;
  }, [allShops, form, title]);

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    handleAuthenticate(values);
  };

  const onPasswordless = () => {
    const username = form.getValues('username');
    if (!username) {
      setMessage({ message: 'Username is required', type: 'error' });
      return;
    }
    handlePasswordless(username);
  };

  const handleBiometric = () => {
    const username = form.getValues('username');
    if (!username) {
      setMessage({ message: 'Username is required', type: 'error' });
      return;
    }
    setTab('multi-factor');
  };
  const loginAs = useCallback(
    (username: string, password: string) => {
      form.setValue('username', username, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: false,
      });
      form.setValue('password', password, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: false,
      });
      handleAuthenticate({ username, password, email: '', shopIds: [] });
    },
    [form, handleAuthenticate]
  );
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-surface rounded gap-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="form">
          <UsernameField form={form} />

          {title === 'Registration' && (
            <RegistrationFields
              form={form}
              allShops={allShops}
              loadShops={loadShops}
              isLoadingShops={listShopsQuery.isLoading}
            />
          )}

          <PasswordField form={form} title={title} />

          <div className="flex items-center justify-between flex-col">
            {title === 'Login' && (
              <Button
                type="button"
                variant="link"
                className="shadow-none self-center w-full p-0"
                onClick={onPasswordless}
              >
                Use passwordless {title.toLowerCase()}
              </Button>
            )}
            <Button
              type="button"
              variant="link"
              className="shadow-none self-center w-full p-0"
              onClick={handleBiometric}
            >
              Use biometric {title.toLowerCase()}
            </Button>
            {title === 'Login' && (
              <TestAccountsDialog
                disabled={isAuthenticating}
                onSelect={loginAs}
              />
            )}
            <Button
              type="submit"
              className="w-full p-0"
              disabled={isRegistering || isAuthenticating}
            >
              {title}
            </Button>
          </div>
        </form>
      </Form>
      {message.message && (
        <div
          className={`${
            message.type === 'success' ? 'text-green-500' : 'text-red-500'
          }`}
        >
          {message.message}
        </div>
      )}
    </div>
  );
}
