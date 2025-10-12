'use client';
import { handleConfirmPassword } from '@/lib/confirmPassword';
import BiometricAuth from './BiometricAuth';
import Modal from './Modal';
import { useState } from 'react';
import { useUser } from '@/hooks/useUserContext';
import ConfirmPassword from './ConfirmPassword';

export default function BiometricAuthModel({
  setShowChangeBiometricModal,
}: {
  setShowChangeBiometricModal: (show: boolean) => void;
}) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ message: '', type: '' });
  const { user } = useUser();
  const username = user?.username;

  const handleSubmit = async () => {
    const result = await handleConfirmPassword(
      username as string,
      confirmPassword
    );
    if (result) {
      setIsConfirmed(true);
    } else {
      setMessage({ message: 'Password confirmation failed', type: 'error' });
    }
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
      open={true}
      onClose={handleClose}
      footer={
        isConfirmed ? null : (
          <button className="btn-primary" onClick={handleSubmit}>
            Submit
          </button>
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
