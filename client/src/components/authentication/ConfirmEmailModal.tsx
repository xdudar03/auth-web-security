'use client';

import Modal from '../Modal';
import { useTRPC } from '@/hooks/TrpcContext';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { useUser } from '@/hooks/useUserContext';

export default function ConfirmEmailModal({ token }: { token: string | null }) {
  const [message, setMessage] = useState({ message: '', type: '' });
  const trpc = useTRPC();
  const { user } = useUser();
  console.log('user', user);
  const router = useRouter();
  const verifyTokenMutation = useMutation(
    trpc.email.verifyToken.mutationOptions({
      onSuccess: (data: { userId: string }) => {
        console.log('token verified: ', data);
        setMessage({
          message: 'Email confirmed successfully',
          type: 'success',
        });
      },
      onError: (error) => {
        console.error('Error verifying token', error);
        setMessage({
          message: 'Error verifying token',
          type: 'error',
        });
      },
    })
  );
  const redirectToDashboard = async () => {
    if (!token) {
      setMessage({
        message: 'Token is required',
        type: 'error',
      });
      return;
    }
    const data = await verifyTokenMutation.mutateAsync({
      token: token,
      purpose: 'confirmation',
    });
    console.log('data', data);
    if (!data?.userId) {
      setMessage({
        message: 'Error verifying token',
        type: 'error',
      });
      return;
    }
    router.push('/dashboard'); // TODO: redirect to dashboard based on role
  };
  return (
    <Modal
      title="Confirming your email..."
      description={
        verifyTokenMutation.isSuccess
          ? 'Email confirmed successfully'
          : `Please wait while we confirm your email... `
      }
      open={true}
      onClose={() => {}}
      footer={
        verifyTokenMutation.isSuccess ? (
          <Button onClick={redirectToDashboard}>Go to Dashboard</Button>
        ) : null
      }
    >
      {message.message && (
        <div
          className={`${
            message.type === 'success' ? 'text-green-500' : 'text-red-500'
          }`}
        >
          {message.message}
        </div>
      )}
    </Modal>
  );
}
