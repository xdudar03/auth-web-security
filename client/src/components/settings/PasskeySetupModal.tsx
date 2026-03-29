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
  const { user } = useUser();
  const [isConfirmed, setIsConfirmed] = useState(false);
  const trpc = useTRPC();
  const confirmPasswordMutation = useMutation(
    trpc.user.confirmPassword.mutationOptions({
      onSuccess: () => {
        setIsConfirmed(true);
      },
      onError: (error) => {
        setMessage({
          message: `Password confirmation failed: ${error.message}`,
          type: 'error',
        });
      },
    })
  );

  const getRegistrationOptionsMutation = useMutation(
    trpc.passwordless.getRegistrationOptions.mutationOptions({
      onError: (error) => {
        setMessage({
          message: `Failed to get registration options: ${error.message}`,
          type: 'error',
        });
      },
    })
  );

  const verifyRegistrationMutation = useMutation(
    trpc.passwordless.verifyRegistration.mutationOptions({
      onSuccess: () => {
        setMessage({
          message: 'Passkey registered successfully',
          type: 'success',
        });
        setTimeout(() => {
          setShowPasskeySetupModal(false);
        }, 2000);
      },
      onError: (error) => {
        setMessage({
          message: `Passkey registration failed: ${error.message}`,
          type: 'error',
        });
      },
    })
  );

  const handleSubmit = async () => {
    const confirmed = await confirmPasswordMutation.mutateAsync({
      password: confirmPassword,
    });
    if (confirmed) {
      const options = await getRegistrationOptionsMutation.mutateAsync({
        userId: user!.userId,
      });
      const attResp = await startRegistration({ optionsJSON: options });
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
        <div className="alert alert-success">
          Passkey registered successfully
        </div>
      ) : (
        <ConfirmPassword
          setConfirmPassword={setConfirmPassword}
          message={message}
        />
      )}
    </Modal>
  );
}
