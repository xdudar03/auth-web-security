import { useUser } from '@/hooks/useUserContext';
import { useState } from 'react';
import ConfirmPassword from '../ConfirmPassword';
import Modal from '../Modal';
import { Button } from '@/components/ui/button';
import { useTRPC } from '@/hooks/TrpcContext';
import { startRegistration } from '@simplewebauthn/browser';
import { useMutation } from '@tanstack/react-query';

export default function PasskeySetupModal({
  setShowPasskeySetupModal,
}: {
  setShowPasskeySetupModal: (show: boolean) => void;
}) {
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ message: '', type: '' });
  const { user, setUser } = useUser();
  const username = user?.username;
  const [isConfirmed, setIsConfirmed] = useState(false);
  const trpc = useTRPC();
  const confirmPasswordMutation = useMutation(
    trpc.biometric.confirmPassword.mutationOptions({
      onSuccess: (data) => {
        console.log('data', data);
        setIsConfirmed(true);
      },
      onError: (error) => {
        console.error('error', error);
        setMessage({
          message: 'Password confirmation failed',
          type: 'error',
        });
      },
    })
  );

  const getRegistrationOptionsMutation = useMutation(
    trpc.passwordless.getRegistrationOptions.mutationOptions({
      onError: (error) => {
        console.error('error', error);
      },
    })
  );

  const verifyRegistrationMutation = useMutation(
    trpc.passwordless.verifyRegistration.mutationOptions({
      onSuccess: (data) => {
        console.log('data', data);
        setUser(data.user);
        setMessage({
          message: 'Passkey registered successfully',
          type: 'success',
        });
        setTimeout(() => {
          setShowPasskeySetupModal(false);
        }, 2000);
      },
      onError: (error) => {
        console.error('error', error);
        setMessage({
          message: 'Passkey registration failed',
          type: 'error',
        });
      },
    })
  );

  const handleSubmit = async () => {
    // const isConfirmed = await confirmPasswordMutation.mutateAsync({
    const confirmed = await confirmPasswordMutation.mutateAsync({
      username: username as string,
      password: confirmPassword,
    });
    if (confirmed) {
      const options = await getRegistrationOptionsMutation.mutateAsync({
        username: username as string,
      });
      console.log('options', options);
      const attResp = await startRegistration({ optionsJSON: options });
      console.log('attResp', attResp);
      await verifyRegistrationMutation.mutateAsync(attResp);
    }
  };
  const handleClose = () => {
    setShowPasskeySetupModal(false);
    setIsConfirmed(false);
    setConfirmPassword('');
    setMessage({ message: '', type: '' });
  };
  return (
    <Modal
      title="Passkey Registration"
      description="Enter your password to register a passkey."
      onClose={handleClose}
      footer={
        isConfirmed ? (
          <Button onClick={handleClose}>Done</Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={
              confirmPasswordMutation.isPending ||
              getRegistrationOptionsMutation.isPending ||
              verifyRegistrationMutation.isPending
            }
          >
            Submit
          </Button>
        )
      }
      open={true}
    >
      {isConfirmed ? (
        <p>{message.message}</p>
      ) : (
        <ConfirmPassword
          setConfirmPassword={setConfirmPassword}
          message={message}
        />
      )}
    </Modal>
  );
}
