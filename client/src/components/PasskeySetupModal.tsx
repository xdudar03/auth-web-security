import { User, useUser } from '@/hooks/useUserContext';
import { handleConfirmPassword } from '@/lib/confirmPassword';
import { useState } from 'react';
import ConfirmPassword from './ConfirmPassword';
import Modal from './Modal';
import { handleRegisterPasskey } from '@/lib/registrationPasswordless';
import { handleOptions } from '@/lib/registrationPasswordless';

export default function PasskeySetupModal({
  setShowPasskeySetupModal,
}: {
  setShowPasskeySetupModal: (show: boolean) => void;
}) {
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ message: '', type: '' });
  const { user } = useUser();
  const username = user?.username;
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleSubmit = async () => {
    const result = await handleConfirmPassword(
      username as string,
      confirmPassword
    );
    if (result) {
      // After confirming password, immediately start passkey registration
      try {
        const attResp = await handleOptions(user as User);
        const ok = await handleRegisterPasskey(username as string, attResp);
        if (ok) {
          setIsConfirmed(true);
          setMessage({
            message: 'Passkey registered successfully',
            type: 'success',
          });
        } else {
          setMessage({ message: 'Passkey registration failed', type: 'error' });
        }
      } catch (e) {
        const err = e as Error;
        setMessage({
          message: err?.message || 'Passkey setup failed',
          type: 'error',
        });
      }
    } else {
      setMessage({ message: 'Password confirmation failed', type: 'error' });
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
      onClose={handleClose}
      footer={
        isConfirmed ? null : (
          <button className="btn-primary" onClick={handleSubmit}>
            Submit
          </button>
        )
      }
      open={true}
    >
      {isConfirmed ? (
        <p>Passkey registered successfully</p>
      ) : (
        <ConfirmPassword
          setConfirmPassword={setConfirmPassword}
          message={message}
        />
      )}
    </Modal>
  );
}
