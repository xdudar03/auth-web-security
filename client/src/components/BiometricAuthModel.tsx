'use client';
import { handleConfirmPassword } from '@/lib/confirmPassword';
import BiometricAuth from './BiometricAuth';
import Modal from './Modal';
import { useState } from 'react';
import { useUser } from '@/hooks/useUserContext';

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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'confirmPassword') {
      setConfirmPassword(value);
    }
  };
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
        <div className="form-field flex flex-col gap-2 w-full justify-center  ">
          <label className="form-label" htmlFor="confirmPassword">
            Confirm your password
          </label>
          <input
            className="form-input"
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            placeholder="Enter your password"
            onChange={handleChange}
          />
          {message.message && (
            <p
              className={`${
                message.type === 'error' ? 'text-error' : 'text-success'
              }`}
            >
              {message.message}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
