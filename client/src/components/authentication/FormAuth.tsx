'use client';

// import { useEffect } from 'react';
import { handleAuthenticatePasswordless } from '@/lib/authentication/authenticationPasswordless';
import { Role, useUser, type User } from '@/hooks/useUserContext';
import { handleRegister } from '@/lib/authentication/registration';
import { useRouter } from 'next/navigation';
import { handleAuthenticate } from '@/lib/authentication/authentication';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
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
import { useTRPC } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
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

  const authenticateMutation = useMutation(
    trpc.biometric.authenticate.mutationOptions({
      onSuccess: (data) => {
        console.log('data', data);
        setUser(data.user as User);
        setRole(data.role as Role);
        setIsAuthenticated(true);
        if (data.role.canAccessAdminPanel) {
          router.push('/admin-dashboard');
        } else {
          router.push('/dashboard');
        }
      },
      onError: (error) => {
        console.error('error', error);
      },
    })
  );
  const registerMutation = useMutation(
    trpc.biometric.register.mutationOptions({
      onSuccess: (data) => {
        console.log('data', data);
        setUser(data.user as User);
        setRole(data.role as Role);
        setIsAuthenticated(true);
        if (data.role.canAccessAdminPanel) {
          router.push('/admin-dashboard');
        } else {
          router.push('/dashboard');
        }
      },
      onError: (error) => {
        console.error('error', error);
      },
    })
  );

  type FormValues = { username: string; password: string; email: string };

  const form = useForm<FormValues>({
    defaultValues: {
      username: user?.username ?? '',
      password: user?.password ?? '',
      email: user?.email ?? '',
    },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  useEffect(() => {
    const subscription = form.watch((values: Partial<FormValues>) => {
      const { username, password, email } = values;
      setUser({
        ...(user ?? {}),
        username: username ?? user?.username ?? '',
        password: password ?? user?.password ?? '',
        email: email ?? user?.email ?? '',
      } as User);
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch, setUser]);

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    console.log('submitting users', { ...user, ...values });
    if (title === 'Registration') {
      const id = crypto.randomUUID(); // TODO: generate id from server
      const userWithId = {
        ...(user ?? {}),
        ...values,
        id: id,
        roleId: 2,
      } as User;
      registerMutation.mutate({
        username: values.username,
        email: values.email,
        password: values.password,
        id: id,
        roleId: 2,
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
    const result = await handleAuthenticatePasswordless(
      username,
      user?.id ?? ''
    );
    if (result.user) {
      setUser(result.user as User);
      setRole(result.role as Role);
      setIsAuthenticated(true);
      if (result.role.canAccessAdminPanel) {
        router.push('/admin-dashboard');
      } else {
        router.push('/dashboard');
      }
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
