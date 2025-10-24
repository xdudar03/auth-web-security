'use client';
import { Role, Shop, useUser, type User } from '@/hooks/useUserContext';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEffect, useCallback, useMemo } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { useTRPC } from '@/hooks/TrpcContext';
import { useMutation, useQuery } from '@tanstack/react-query';
import { startAuthentication } from '@simplewebauthn/browser';
import dynamic from 'next/dynamic';
import type { MultiValue, StylesConfig } from 'react-select';

type SuccessData = {
  user: User;
  role: Role;
};

type FormValues = {
  username: string;
  password: string;
  email: string;
  shopIds: number[];
};

const AsyncSelect = dynamic(() => import('react-select/async'), {
  ssr: false,
});

export default function FormAuth({
  setTab,
  title,
}: {
  setTab: (tab: string) => void;
  title: string;
}) {
  const { user, setUser, setIsAuthenticated, setRole } = useUser();
  const trpc = useTRPC();
  const router = useRouter();
  const listShopsQuery = useQuery(trpc.shops.getAllShops.queryOptions());
  const allShops = useMemo(
    () => listShopsQuery.data?.shops ?? [],
    [listShopsQuery.data?.shops]
  );
  console.log('allShops', allShops);

  function handleSuccess(data: SuccessData) {
    setUser(data.user);
    setRole(data.role);
    setIsAuthenticated(true);
    if (data.role.canAccessAdminPanel) {
      router.push('/admin-dashboard');
    } else {
      router.push('/dashboard');
    }
  }

  const authenticateMutation = useMutation(
    trpc.biometric.authenticate.mutationOptions({
      onSuccess: (data: SuccessData) => {
        console.log('data', data);
        handleSuccess(data);
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
        handleSuccess(data);
      },
      onError: (error) => {
        console.error('error', error);
      },
    })
  );

  const getAuthenticationOptionsMutation = useMutation(
    trpc.passwordless.getAuthenticationOptions.mutationOptions({
      onError: (error) => {
        console.error('error', error);
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
      },
    })
  );

  const form = useForm<FormValues>({
    defaultValues: {
      username: user?.username ?? '',
      password: user?.password ?? '',
      email: user?.email ?? '',
      shopIds: allShops.map((shop: Shop) => shop.id),
    },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  // Debounced async function to load shops
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
          value: shop.id,
        }));
      } catch (error) {
        console.error('Error loading shops:', error);
        return [];
      }
    },
    [allShops]
  );

  useEffect(() => {
    const subscription = form.watch((value) => {
      const { username, password, email } = value as FormValues;
      setUser({
        ...(user ?? {}),
        username: username ?? user?.username ?? '',
        password: password ?? user?.password ?? '',
        email: email ?? user?.email ?? '',
        // shopIds: shopIds ?? allShops.map((shop: Shop) => shop.id) ?? [],
      } as User);
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch, setUser]);

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    console.log('submitting users', { ...user, ...values });
    if (title === 'Registration') {
      const id = crypto.randomUUID(); // TODO: generate id from server
      registerMutation.mutate({
        username: values.username,
        email: values.email,
        password: values.password,
        userId: id,
        roleId: 2,
        shopIds: values.shopIds,
      });
    } else {
      authenticateMutation.mutate({
        username: values.username,
        password: values.password,
      });
    }
  };

  const handlePasswordless = async () => {
    const username = form.getValues('username');
    if (!username) {
      console.error('Username is required for passwordless');
      return;
    }
    try {
      const options = await getAuthenticationOptionsMutation.mutateAsync({
        username,
      });
      const attResp = await startAuthentication({
        optionsJSON: options,
      });

      await verifyAuthenticationMutation.mutateAsync(attResp);
    } catch (error) {
      console.error('Passwordless authentication failed', error);
    }
  };

  const handleBiometric = () => {
    const username = form.getValues('username');
    if (!username) {
      alert('Username is required');
      return;
    }
    setTab('multi-factor');
  };
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-surface rounded gap-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="form">
          <FormField
            control={form.control}
            name="username"
            rules={{ required: 'Username is required' }}
            render={({ field }) => (
              <FormItem className="form-field">
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Enter your username"
                    autoComplete="username"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {title === 'Registration' && (
            <FormField
              control={form.control}
              name="email"
              rules={{ required: 'Email is required' }}
              render={({ field }) => (
                <FormItem className="form-field">
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="password"
            rules={{ required: 'Password is required' }}
            render={({ field }) => (
              <FormItem className="form-field">
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    autoComplete={
                      title === 'Registration'
                        ? 'new-password'
                        : 'current-password'
                    }
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Use at least 8 characters, including a number and a symbol.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {title === 'Registration' && (
            <FormField
              control={form.control}
              name="shopIds"
              rules={{ required: 'Shop is required' }}
              render={() => (
                <FormItem className="form-field">
                  <FormLabel>Shops</FormLabel>
                  <FormControl>
                    <AsyncSelect
                      instanceId="shop-select"
                      loadOptions={loadShops}
                      defaultOptions={allShops.map((shop: Shop) => ({
                        label: shop.shopName,
                        value: shop.id,
                      }))}
                      isMulti
                      isLoading={listShopsQuery.isLoading}
                      placeholder="Search and select shops..."
                      loadingMessage={() => 'Loading shops...'}
                      noOptionsMessage={({
                        inputValue,
                      }: {
                        inputValue: string;
                      }) =>
                        inputValue
                          ? `No shops found for "${inputValue}"`
                          : 'No shops available'
                      }
                      value={form
                        .watch('shopIds')
                        ?.map((id: number) => {
                          const shop = allShops.find((s: Shop) => s.id === id);
                          return shop
                            ? { label: shop.shopName, value: shop.id }
                            : null;
                        })
                        .filter(Boolean)}
                      onChange={(newValue) => {
                        const selectedOptions = newValue as MultiValue<{
                          label: string;
                          value: number;
                        }>;
                        const shopIds = selectedOptions.map(
                          (option) => option.value
                        );
                        form.setValue('shopIds', shopIds);
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}

          <div className="flex items-center justify-between flex-col">
            {title === 'Login' && (
              <Button
                type="button"
                variant="link"
                className="shadow-none self-center w-full p-0"
                onClick={handlePasswordless}
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
            <Button type="submit" className="w-full p-0">
              {title}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
