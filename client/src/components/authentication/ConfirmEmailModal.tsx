'use client';

import Modal from '../Modal';
import { useTRPC } from '@/hooks/TrpcContext';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import useJwt from '@/hooks/useJwt';

export default function ConfirmEmailModal({ token }: { token: string | null }) {
  const [message, setMessage] = useState({ message: '', type: '' });
  const trpc = useTRPC();

  const router = useRouter();
  const { setJwt } = useJwt();
  const verifyTokenMutation = useMutation(
    trpc.email.verifyToken.mutationOptions({
      onSuccess: (data) => {
        console.log('token verified: ', data);
        if ('jwt' in data && data.jwt) {
          setJwt(data.jwt);
        }
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

  useEffect(() => {
    if (!token) {
      setMessage({
        message: 'Token is required',
        type: 'error',
      });
      return;
    }
    console.log('token', token);
    console.log('purpose', 'confirmation');
    verifyTokenMutation.mutate({
      token: token,
      purpose: 'confirmation',
    });
  }, []);
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
          <Button onClick={() => router.push('/dashboard')}>
            Go to Dashboard
          </Button>
        ) : null
      }
    >
      {message.message && (
        <div
          className={
            message.type === 'success' ? 'text-green-500' : 'text-red-500'
          }
        >
          {message.message}
        </div>
      )}
    </Modal>
  );
}
