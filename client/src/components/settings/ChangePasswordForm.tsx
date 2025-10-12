'use client';
import { handleChangePassword } from '@/lib/settings/changePassword';
import { useUser } from '@/hooks/useUserContext';
import { useState } from 'react';
import Modal from '../Modal';

export default function ChangePasswordForm({
  setShowChangePasswordModal,
}: {
  setShowChangePasswordModal: (show: boolean) => void;
}) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ message: '', type: '' });
  const { user } = useUser();
  const username = user?.username;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'oldPassword') {
      setOldPassword(value);
    } else if (name === 'newPassword') {
      setNewPassword(value);
    } else if (name === 'confirmPassword') {
      setConfirmPassword(value);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('oldPassword', oldPassword);
    console.log('newPassword', newPassword);
    console.log('confirmPassword', confirmPassword);
    if (oldPassword === '') {
      setMessage({ message: 'Old password is required', type: 'error' });
      return;
    }
    if (newPassword === '') {
      setMessage({ message: 'New password is required', type: 'error' });
      return;
    }
    if (confirmPassword === '') {
      setMessage({ message: 'Confirm password is required', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({
        message: 'New password and confirm password do not match',
        type: 'error',
      });
      return;
    }
    if (oldPassword === newPassword) {
      setMessage({
        message: 'New password and old password cannot be the same',
        type: 'error',
      });
      return;
    }
    const result = await handleChangePassword(
      username as string,
      oldPassword,
      newPassword
    );
    if (result) {
      setMessage({ message: 'Password changed successfully', type: 'success' });
      setTimeout(() => {
        setShowChangePasswordModal(false);
      }, 2000);
    } else {
      setMessage({ message: 'Password change failed', type: 'error' });
    }
  };
  return (
    <Modal
      open={true}
      onClose={() => setShowChangePasswordModal(false)}
      title="Change Password"
      footer={
        <button
          form="change-password-form"
          type="submit"
          className="btn-primary"
        >
          Save
        </button>
      }
    >
      <form id="change-password-form" onSubmit={onSubmit} className="form">
        <div className="form-field">
          <label className="form-label" htmlFor="oldPassword">
            Old password
          </label>
          <input
            id="oldPassword"
            type="password"
            name="oldPassword"
            onChange={handleChange}
            className="form-input"
            placeholder="Enter your current password"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="newPassword">
            New password
          </label>
          <input
            id="newPassword"
            type="password"
            name="newPassword"
            onChange={handleChange}
            className="form-input"
            placeholder="Enter a new password"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="confirmPassword">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            onChange={handleChange}
            className="form-input"
            placeholder="Re-enter the new password"
          />
        </div>
        {message?.message && (
          <div
            className={`alert ${
              message.type === 'success' ? 'alert-success' : 'alert-error'
            }`}
          >
            {message.message}
          </div>
        )}
      </form>
    </Modal>
  );
}
