'use client';
import BiometricAuth from '../authentication/BiometricAuth';
import Modal from '../Modal';
import { useState } from 'react';
import { useUser } from '@/hooks/useUserContext';
import ConfirmPassword from '../ConfirmPassword';
import { Button } from '@/components/ui/button';
import { useTRPC } from '@/hooks/TrpcContext';
import { useMutation } from '@tanstack/react-query';

export default function BiometricAuthModel({
  setShowChangeBiometricModal,
}: {
  setShowChangeBiometricModal: (show: boolean) => void;
}) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ message: '', type: '' });
  const { user } = useUser();
  const trpc = useTRPC();
  const confirmPasswordMutation = useMutation(
    trpc.user.confirmPassword.mutationOptions({
      onSuccess: (data) => {
        console.log('data', data);
        setIsConfirmed(true);
      },
      onError: (error) => {
        console.error('error', error);
        setMessage({ message: 'Password confirmation failed', type: 'error' });
      },
    })
  );

  const handleSubmit = async () => {
    await confirmPasswordMutation.mutateAsync({
      password: confirmPassword,
    });
  };
  const handleClose = () => {
    setShowChangeBiometricModal(false);
    setIsConfirmed(false);
    setConfirmPassword('');
    setMessage({ message: '', type: '' });
  };
  return (
    <Modal
      title="Biometric Authentication"
      description="Register your face for biometric authentication."
      open={true}
      onClose={handleClose}
      footer={
        isConfirmed ? null : (
          <Button
            onClick={handleSubmit}
            disabled={confirmPasswordMutation.isPending}
          >
            Submit
          </Button>
        )
      }
    >
      {isConfirmed ? (
        <BiometricAuth title="" action="change" />
      ) : (
        <ConfirmPassword
          setConfirmPassword={setConfirmPassword}
          message={message}
        />
      )}
    </Modal>
  );
}
