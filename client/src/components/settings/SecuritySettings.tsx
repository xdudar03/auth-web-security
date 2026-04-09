import { useUser } from '@/hooks/useUserContext';
import { useEffect, useState } from 'react';
import ChangePasswordForm from './ChangePasswordForm';
import BiometricAuthModel from './BiometricAuthModel';
import PasskeySetupModal from './PasskeySetupModal';
import { Lock, KeyRound, ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useTRPC } from '@/hooks/TrpcContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function SecuritySettings() {
  const { user } = useUser();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isBiometric = user?.isBiometric;
  const isMfaEnabled = user?.MFAEnabled ?? false;
  const parsedCredentials = user?.credentials
    ? JSON.parse(user?.credentials)
    : [];
  const isPasskey =
    parsedCredentials &&
    Array.isArray(parsedCredentials) &&
    parsedCredentials.length > 0;

  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showChangeBiometricModal, setShowChangeBiometricModal] =
    useState(false);
  const [showPasskeySetupModal, setShowPasskeySetupModal] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(isMfaEnabled);

  useEffect(() => {
    setMfaEnabled(isMfaEnabled);
  }, [isMfaEnabled]);

  const updateMfaPreferenceMutation = useMutation(
    trpc.user.updateMfaPreference.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.info.getUserInfo.queryOptions().queryKey,
        });
      },
      onError: (_error, variables) => {
        setMfaEnabled(!variables.enabled);
      },
    })
  );

  const handleMfaToggle = (checked: boolean) => {
    setMfaEnabled(checked);
    updateMfaPreferenceMutation.mutate({ enabled: checked });
  };

  return (
    <div className="w-full mx-auto space-y-6 border-t border-border pt-4 ">
      <div className="flex flex-col gap-2 ">
        <h1 className="text-xl font-semibold">Security settings</h1>
        <p className="text-sm text-muted">
          Manage how you sign in and protect your account.
        </p>
      </div>

      <div className="w-full rounded-lg border border-border/70 bg-background/60 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Enable MFA</p>
            <p className="text-xs text-muted">
              Save your multi-factor authentication preference for this account.
            </p>
          </div>
          <Switch
            checked={mfaEnabled}
            disabled={updateMfaPreferenceMutation.isPending}
            onCheckedChange={handleMfaToggle}
            aria-label="Enable MFA"
          />
        </div>
      </div>

      {/* Password */}
      <div className="signin-methods">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-muted mt-0.5" />
          <div>
            <h2 className="font-medium">Password</h2>
            <p className="text-sm text-muted">Update your account password.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowChangePasswordModal(true)}
          >
            Change password
          </Button>
        </div>
      </div>
      {showChangePasswordModal && (
        <ChangePasswordForm
          mode="change"
          setShowChangePasswordModal={setShowChangePasswordModal}
        />
      )}

      {/* Biometric */}
      <div className="signin-methods">
        <div className="flex items-start gap-3">
          <ScanFace className="w-5 h-5 text-muted mt-0.5" />
          <div>
            <h2 className="font-medium">Biometric</h2>
            <p className="text-sm text-muted">
              {isBiometric
                ? 'Biometric sign-in is enabled.'
                : 'Set up biometric authentication to secure your account.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className={
              isBiometric ? '' : 'bg-warning hover:bg-warning/90 border-warning'
            }
            onClick={() => setShowChangeBiometricModal(true)}
          >
            {isBiometric ? 'Add another biometric' : 'Set up biometric'}
          </Button>
        </div>
      </div>
      {showChangeBiometricModal && (
        <BiometricAuthModel
          setShowChangeBiometricModal={setShowChangeBiometricModal}
        />
      )}

      {/* Passkeys */}
      <div className="signin-methods">
        <div className="flex items-start gap-3">
          <KeyRound className="w-5 h-5 text-muted mt-0.5" />
          <div>
            <h2 className="font-medium">Passkeys</h2>
            <p className="text-sm text-muted">
              {isPasskey
                ? 'Use your device passkey to sign in without a password.'
                : 'Create a passkey for simple and secure sign-in.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className={
              isPasskey ? '' : 'bg-warning hover:bg-warning/90 border-warning'
            }
            onClick={() => setShowPasskeySetupModal(true)}
          >
            {isPasskey ? 'Add another passkey' : 'Set up passkey'}
          </Button>
        </div>
      </div>
      {showPasskeySetupModal && (
        <PasskeySetupModal
          setShowPasskeySetupModal={setShowPasskeySetupModal}
        />
      )}
    </div>
  );
}
