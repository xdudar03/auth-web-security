'use client';
import { useState } from 'react';
import Modal from '../Modal';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTRPC } from '@/hooks/TrpcContext';
import { useMutation } from '@tanstack/react-query';

export default function ChangePasswordForm({
  mode,
  setShowChangePasswordModal,
  token,
}: {
  mode: 'reset' | 'change';
  setShowChangePasswordModal: (show: boolean) => void;
  token?: string | null;
}) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ message: '', type: '' });
  const trpc = useTRPC();

  const verifyResetPasswordTokenMutation = useMutation(
    trpc.email.verifyToken.mutationOptions({
      onSuccess: (data) => {
        console.log('reset password token verified: ', data);
      },
      onError: (error) => {
        console.error('Error verifying reset password token', error);
      },
    })
  );
  const resetPasswordMutation = useMutation(
    trpc.email.resetPassword.mutationOptions({
      onSuccess: (data) => {
        console.log('reset password successful: ', data);
        setMessage({
          message: 'Password reset successful',
          type: 'success',
        });
      },
      onError: (error) => {
        console.error('Error resetting password', error);
        setMessage({
          message: 'Error resetting password',
          type: 'error',
        });
      },
    })
  );
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
    if (newPassword !== confirmPassword) {
      setMessage({
        message: 'New password and confirm password do not match',
        type: 'error',
      });
      return;
    }
    if (mode === 'reset') {
      if (!token) {
        setMessage({ message: 'Token is required', type: 'error' });
        return;
      }
      const result = await verifyResetPasswordTokenMutation.mutateAsync({
        token: token as string,
        purpose: 'reset_password',
      });
      if (!result.userId) {
        setMessage({ message: 'User not found', type: 'error' });
        return;
      }
      await resetPasswordMutation.mutateAsync({
        token: token as string,
        newPassword,
        userId: result.userId as string,
      });
    }
    if (mode === 'change') {
      if (oldPassword === '') {
        setMessage({ message: 'Old password is required', type: 'error' });
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
        oldPassword,
        newPassword,
      });
    }
  };
  return (
    <Modal
      open={true}
      onClose={() => setShowChangePasswordModal(false)}
      title={mode === 'reset' ? 'Reset Password' : 'Change Password'}
      description={
        mode === 'reset'
          ? 'Enter your new password to reset your password.'
          : 'Enter your current password and a new password to change your password.'
      }
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
          {mode === 'change' && (
            <>
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
            </>
          )}
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
