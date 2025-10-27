'use client';
import ChangePasswordForm from '@/components/settings/ChangePasswordForm';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ResetPasswordPage() {
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(true);
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  console.log('token: ', token);

  return (
    <ChangePasswordForm
      mode="reset"
      setShowChangePasswordModal={setShowChangePasswordModal}
      token={token}
    />
  );
}
