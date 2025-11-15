'use client';
import ChangePasswordForm from '@/components/settings/ChangePasswordForm';
import { Suspense, useState } from 'react';

export default function ResetPasswordPage() {
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(true);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChangePasswordForm
        mode="reset"
        setShowChangePasswordModal={setShowChangePasswordModal}
      />
    </Suspense>
  );
}
