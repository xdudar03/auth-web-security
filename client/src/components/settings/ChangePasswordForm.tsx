'use client';
import { useUser } from '@/hooks/useUserContext';
import { useState } from 'react';
import Modal from '../Modal';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTRPC } from '@/hooks/TrpcContext';
import { useMutation } from '@tanstack/react-query';

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
  const trpc = useTRPC();
  const username = user?.username;
  const changePassword = useMutation(
    trpc.biometric.changePassword.mutationOptions({
      onSuccess: (data) => {
        console.log('data', data);
        setMessage({
          message: 'Password changed successfully',
          type: 'success',
        });
        setTimeout(() => {
          setShowChangePasswordModal(false);
        }, 2000);
      },
      onError: (error) => {
        console.error('error', error);
      },
    })
  );

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

    await changePassword.mutateAsync({
      username: username as string,
      oldPassword,
      newPassword,
    });
  };
  return (
    <Modal
      open={true}
      onClose={() => setShowChangePasswordModal(false)}
      title="Change Password"
      description="Enter your current password and a new password to change your password."
      footer={
        <Button
          form="change-password-form"
          type="submit"
          disabled={changePassword.isPending}
        >
          Save
        </Button>
      }
    >
      <form id="change-password-form" onSubmit={onSubmit} className="form">
        <div className="form-field">
          <Label className="form-label" htmlFor="oldPassword">
            Old password
          </Label>
          <Input
            id="oldPassword"
            type="password"
            name="oldPassword"
            onChange={handleChange}
            placeholder="Enter your current password"
            value={oldPassword}
          />
        </div>
        <div className="form-field">
          <Label className="form-label" htmlFor="newPassword">
            New password
          </Label>
          <Input
            id="newPassword"
            type="password"
            name="newPassword"
            onChange={handleChange}
            placeholder="Enter a new password"
            value={newPassword}
          />
        </div>
        <div className="form-field">
          <Label className="form-label" htmlFor="confirmPassword">
            Confirm new password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            onChange={handleChange}
            placeholder="Re-enter the new password"
            value={confirmPassword}
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
