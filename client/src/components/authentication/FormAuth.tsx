'use client';
import { Shop, useUser, type User } from '@/hooks/useUserContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useTRPC } from '@/hooks/TrpcContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useAuth from '@/hooks/useAuth';
import useJwt from '@/hooks/useJwt';
import type { FormValues } from '@/types/authentication';
import UsernameField from './UsernameField';
import PasswordField from './PasswordField';
import RegistrationFields from './RegistrationFields';
import TestAccountsDialog from './TestAccountsDialog';
import { Input } from '@/components/ui/input';
import EmailMfaStep from './EmailMfaStep';
import { FlaskConical, KeyRound, ScanFace } from 'lucide-react';

export default function FormAuth({
  setTab,
  title,
  tab,
}: {
  setTab: (tab: string) => void;
  title: string;
  tab?: string;
}) {
  const { user, role, isAuthenticated } = useUser();
  const { setJwt } = useJwt();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState({ message: '', type: '' });
  const [showRecoveryPassphraseField, setShowRecoveryPassphraseField] =
    useState(false);
  const [mfaEmail, setMfaEmail] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const previousTabRef = useRef(tab);
  const listShopsQuery = useQuery(trpc.shops.getAllShops.queryOptions());
  const allShops = useMemo(
    () => listShopsQuery.data?.shops ?? [],
    [listShopsQuery.data?.shops]
  );
  const handleAuthMessage = useCallback(
    (next: { message: string; type: 'success' | 'error' }) => {
      setMessage(next);
      if (
        title === 'Login' &&
        next.type === 'error' &&
        /(recovery passphrase|locked on this device)/i.test(next.message)
      ) {
        setShowRecoveryPassphraseField(true);
      }
    },
    [title]
  );

  const {
    handleAuthenticate,
    handlePasswordless,
    handleSendMfaCode,
    handleVerifyMfaCode,
    loadShops,
    pendingMfa,
    isMfaCodeSent,
    resetMfaState,
    isRegistering,
    isAuthenticating,
  } = useAuth({
    handleSuccess: handleSuccess,
    allShops: allShops as Shop[],
    user: user as User,
    title: title,
    setMessage: handleAuthMessage,
  });

  function handleSuccess({ jwt }: { jwt: string }) {
    setMessage({
      message: 'Login successful, redirecting to dashboard...',
      type: 'success',
    });
    // Clear cache before setting new token to avoid stale data from previous session
    queryClient.clear();
    setJwt(jwt);
  }

  useEffect(() => {
    if (!pendingMfa) return;
    setMfaEmail('');
    setMfaCode('');
    setMessage({ message: '', type: '' });
    setTab('send-code');
  }, [pendingMfa, setTab]);

  useEffect(() => {
    const previousTab = previousTabRef.current;
    previousTabRef.current = tab;

    if (title !== 'Login') return;
    if (!pendingMfa) return;
    if (previousTab !== 'send-code' || tab === 'send-code') return;

    resetMfaState();
    setMfaEmail('');
    setMfaCode('');
    setMessage({ message: '', type: '' });
  }, [tab, title, pendingMfa, resetMfaState]);

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
      email: user?.emailHash ?? '',
      shopIds: [],
      recoveryPassphrase: '',
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

  const passwordCheck = (password: string) => {
    if (password.length < 8) {
      setMessage({
        message: 'Password must be at least 8 characters',
        type: 'error',
      });
      return false;
    }
    if (!/[0-9]/.test(password)) {
      setMessage({
        message: 'Password must contain at least one number',
        type: 'error',
      });
      return false;
    }
    return true;
  };

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    if (
      (title === 'Login' && (!values.username || !values.password)) ||
      (title === 'Registration' &&
        (!values.username ||
          !values.password ||
          !values.email ||
          !values.shopIds.length ||
          !values.recoveryPassphrase))
    ) {
      setMessage({
        message: 'Please fill in all fields',
        type: 'error',
      });
      return;
    }
    if (title === 'Registration' && !passwordCheck(values.password)) {
      return;
    }
    handleAuthenticate(values);
  };

  const onPasswordless = () => {
    setMessage({ message: '', type: '' });
    const username = form.getValues('username');
    const recoveryPassphrase = form.getValues('recoveryPassphrase');
    if (!username) {
      setMessage({ message: 'Username is required', type: 'error' });
      return;
    }
    handlePasswordless(username, recoveryPassphrase || undefined);
  };

  const handleBiometric = () => {
    setMessage({ message: '', type: '' });
    // const username = form.getValues('username');
    // if (!username) {
    //   setMessage({ message: 'Username is required', type: 'error' });
    //   return;
    // }
    setTab('biometric');
  };
  const loginAs = useCallback(
    (username: string, password: string) => {
      setMessage({ message: '', type: '' });
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
      handleAuthenticate({
        username,
        password,
        email: '',
        shopIds: [],
        recoveryPassphrase: password,
      });
    },
    [form, handleAuthenticate]
  );

  const loginMethodRows = [
    {
      id: 'passwordless',
      title: 'Passwordless login',
      description: 'Sign in with your saved passkey after entering your username.',
      icon: KeyRound,
      actionLabel: 'Continue',
      onClick: onPasswordless,
    },
    {
      id: 'biometric',
      title: 'Biometric login',
      description: 'Switch to face or fingerprint authentication for this account.',
      icon: ScanFace,
      actionLabel: 'Use biometric',
      onClick: handleBiometric,
    },
  ] as const;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-surface rounded gap-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <Form {...form}>
        <form
          onSubmit={
            pendingMfa
              ? (event) => event.preventDefault()
              : form.handleSubmit(onSubmit)
          }
          className="form"
        >
          {pendingMfa ? (
            <EmailMfaStep
              factorLabel={
                pendingMfa.method === 'password'
                  ? 'Password sign-in'
                  : 'Passwordless sign-in'
              }
              email={mfaEmail}
              code={mfaCode}
              isCodeSent={isMfaCodeSent}
              isSending={isAuthenticating}
              isVerifying={isAuthenticating}
              onEmailChange={setMfaEmail}
              onCodeChange={setMfaCode}
              onSendCode={() => void handleSendMfaCode(mfaEmail)}
              onVerifyCode={() => void handleVerifyMfaCode(mfaCode)}
            />
          ) : (
            <>
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

              {title === 'Login' && (
                <>
                  {!showRecoveryPassphraseField ? (
                    <div className="w-full">
                      <Button
                        type="button"
                        variant="link"
                        className="p-0 h-auto self-start"
                        onClick={() => setShowRecoveryPassphraseField(true)}
                      >
                        Use recovery passphrase for this device
                      </Button>
                      <p className="text-xs text-muted mt-1">
                        If this is a new device, enter your recovery passphrase
                        once to unlock encrypted profile data.
                      </p>
                    </div>
                  ) : (
                    <FormField
                      control={form.control}
                      name="recoveryPassphrase"
                      render={({ field }) => (
                        <FormItem className="form-field">
                          <FormLabel>Recovery Passphrase</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Optional: unlock encrypted profile on this device"
                              autoComplete="current-password"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Needed only when this browser does not have your
                            private key yet.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}
            </>
          )}

          {message.message && (
            <div
              className={`alert ${
                message.type === 'success' ? 'alert-success' : 'alert-error'
              }`}
            >
              {message.message}
            </div>
          )}

          {!pendingMfa && (
            <div className="flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full p-0"
                disabled={isRegistering || isAuthenticating}
              >
                {title}
              </Button>

              {title === 'Login' && (
                <div className="w-full border-t border-border/60 pt-3">
                  <div className="mb-2 space-y-0.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Other sign-in methods
                    </p>
                    <p className="text-xs text-muted">
                      Alternative ways to sign in.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    {loginMethodRows.map((method) => {
                      const Icon = method.icon;

                      return (
                        <div
                          key={method.id}
                          className="flex flex-col gap-2 rounded-md border border-border/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-start gap-3">
                            <Icon className="mt-0.5 h-4 w-4 text-muted" />
                            <div>
                              <p className="text-sm font-medium">{method.title}</p>
                              <p className="text-xs text-muted">
                                {method.description}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto"
                            disabled={isAuthenticating}
                            onClick={method.onClick}
                          >
                            {method.actionLabel}
                          </Button>
                        </div>
                      );
                    })}

                    <div className="flex flex-col gap-2 rounded-md border border-border/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <FlaskConical className="mt-0.5 h-4 w-4 text-muted" />
                        <div>
                          <p className="text-sm font-medium">Use test account</p>
                          <p className="text-xs text-muted">
                            Try a seeded role or privacy setup.
                          </p>
                        </div>
                      </div>
                      <TestAccountsDialog
                        disabled={isAuthenticating}
                        onSelect={loginAs}
                        triggerVariant="outline"
                        triggerClassName="w-full sm:w-auto"
                        triggerLabel="Choose account"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}
