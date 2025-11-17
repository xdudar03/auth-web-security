'use client';

import Modal from '../Modal';
import { useTRPC } from '@/hooks/TrpcContext';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '../ui/button';
import useJwt from '@/hooks/useJwt';

export default function ConfirmEmailModal() {
  const [message, setMessage] = useState({ message: '', type: '' });
  const trpc = useTRPC();

  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const router = useRouter();
  const { setJwt } = useJwt();
  const verifyTokenMutation = useMutation(
    trpc.email.verifyToken.mutationOptions({
      onSuccess: (data) => {
        if ('jwt' in data && data.jwt) {
          setJwt(data.jwt);
        }
        setMessage({
          message: 'Email confirmed successfully',
          type: 'success',
        });
      },
      onError: (error) => {
        setMessage({
          message: `Error verifying token: ${error.message}`,
          type: 'error',
        });
      },
    })
  );

  useEffect(() => {
    if (!token) {
      setMessage({
        message: 'Token is required to confirm your email',
        type: 'error',
      });
      return;
    }
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
          className={`alert ${
            message.type === 'success' ? 'alert-success' : 'alert-error'
          }`}
        >
          {message.message}
        </div>
      )}
    </Modal>
  );
}
