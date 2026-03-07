import { useCallback, useEffect, useId, useState } from 'react';
import { useUser } from '@/hooks/useUserContext';
import { useTRPC } from '@/hooks/TrpcContext';
import { useQuery } from '@tanstack/react-query';
import { Input } from '../ui/input';
import { useRouter } from 'next/navigation';
import BiometricAlerts from './BiometricAlerts';
import BiometricCameraSection from './BiometricCameraSection';
import BiometricImagePreviews from './BiometricImagePreviews';
import useBiometricCapture from '@/hooks/useBiometricCapture';

export default function BiometricAuth({
  title,
  action,
}: {
  title: string;
  action: string;
}) {
  const [username, setUsername] = useState('');
  const [recoveryPassphrase, setRecoveryPassphrase] = useState('');
  const { role, isAuthenticated } = useUser();
  const router = useRouter();
  const trpc = useTRPC();
  const modelStatusQuery = useQuery({
    ...trpc.model.status.queryOptions(),
    enabled: action === 'login',
    refetchInterval: (query) => (query.state.data?.is_training ? 2000 : false),
  });
  const isModelTraining =
    action === 'login' && modelStatusQuery.data?.is_training;
  const {
    videoRef,
    ovalRef,
    isOvalVisible,
    hasCapturedImage,
    capturedImageUrl,
    reconstructedImageUrl,
    feedbackMessage,
    buttonLabel,
    isButtonDisabled,
    handleCaptureClick,
  } = useBiometricCapture({
    action,
    username,
    recoveryPassphrase,
    isModelTraining: Boolean(isModelTraining),
    isModelStatusLoading: modelStatusQuery.isLoading,
    isModelStatusError: modelStatusQuery.isError,
  });
  const maskId = useId();
  const overlayMaskId = `biometric-mask-${maskId.replace(/:/g, '')}`;
  const TARGET_SIZE = 100;

  const redirectToDashboard = useCallback(() => {
    if (role?.canAccessAdminPanel) {
      router.push('/admin-dashboard');
    } else if (role?.canAccessProviderPanel) {
      router.push('/provider-dashboard');
    } else {
      router.push('/dashboard');
    }
  }, [role, router]);

  useEffect(() => {
    if (action !== 'login') return;
    if (!isAuthenticated) return;
    if (!role) return;
    redirectToDashboard();
  }, [action, isAuthenticated, role, redirectToDashboard]);

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-surface rounded gap-6">
      {title !== '' && (
        <h2 className="text-xl font-semibold">
          Biometric {title.toLowerCase()}
        </h2>
      )}
      {action === 'login' && (
        <>
          <Input
            type="text"
            placeholder="Enter your username"
            className="w-full"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Optional: recovery passphrase for first login on this browser"
            className="w-full"
            value={recoveryPassphrase}
            onChange={(e) => setRecoveryPassphrase(e.target.value)}
            autoComplete="current-password"
          />
        </>
      )}
      <BiometricAlerts
        action={action}
        isModelTraining={Boolean(isModelTraining)}
        isModelStatusError={modelStatusQuery.isError}
        feedbackMessage={feedbackMessage}
      />
      <BiometricCameraSection
        videoRef={videoRef}
        ovalRef={ovalRef}
        isOvalVisible={isOvalVisible}
        overlayMaskId={overlayMaskId}
        onButtonClick={handleCaptureClick}
        isButtonDisabled={isButtonDisabled}
        buttonLabel={buttonLabel}
      />
      <BiometricImagePreviews
        hasCapturedImage={hasCapturedImage}
        capturedImageUrl={capturedImageUrl}
        reconstructedImageUrl={reconstructedImageUrl}
        targetSize={TARGET_SIZE}
      />
    </div>
  );
}
