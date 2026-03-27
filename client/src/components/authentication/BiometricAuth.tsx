'use client';
import { useCallback, useEffect, useId, useState } from 'react';
import { useUser } from '@/hooks/useUserContext';
import { Input } from '../ui/input';
import { useRouter } from 'next/navigation';
import BiometricAlerts from './BiometricAlerts';
import BiometricCameraSection from './BiometricCameraSection';
import BiometricImagePreviews from './BiometricImagePreviews';
import useBiometricCapture from '@/hooks/useBiometricCapture';
import AnonymizationSwitch from './AnonymizationSwitch';

export default function BiometricAuth({
  title,
  action,
}: {
  title: string;
  action: string;
}) {
  const [username, setUsername] = useState('');
  const [recoveryPassphrase, setRecoveryPassphrase] = useState('');
  const [showRecoveryPassphraseInput, setShowRecoveryPassphraseInput] =
    useState(false);
  const [anonymizeImage, setAnonymizeImage] = useState(true);
  const { role, isAuthenticated } = useUser();

  const router = useRouter();
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
    anonymizeImage,
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

  useEffect(() => {
    if (action !== 'login') return;
    if (!feedbackMessage || feedbackMessage.type !== 'error') return;
    if (
      /(recovery passphrase|locked on this device)/i.test(feedbackMessage.text)
    ) {
      setShowRecoveryPassphraseInput(true);
    }
  }, [action, feedbackMessage]);

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-surface rounded gap-2">
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
          {!showRecoveryPassphraseInput ? (
            <div className="w-full">
              <button
                type="button"
                className="text-sm underline underline-offset-2 self-start"
                onClick={() => setShowRecoveryPassphraseInput(true)}
              >
                Use recovery passphrase for this device
              </button>
              <p className="text-xs text-muted mt-1">
                If this is a new device, enter your recovery passphrase once to
                unlock encrypted profile data.
              </p>
            </div>
          ) : (
            <Input
              type="password"
              placeholder="Optional: recovery passphrase for first login on this browser"
              className="w-full"
              value={recoveryPassphrase}
              onChange={(e) => setRecoveryPassphrase(e.target.value)}
              autoComplete="current-password"
            />
          )}
        </>
      )}
      <BiometricAlerts action={action} feedbackMessage={feedbackMessage} />
      <AnonymizationSwitch
        anonymizeImage={anonymizeImage}
        setAnonymizeImage={setAnonymizeImage}
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
