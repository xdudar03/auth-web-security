'use client';

import ConfirmEmailModal from '@/components/authentication/ConfirmEmailModal';
import { Suspense } from 'react';

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfirmEmailModal />;
    </Suspense>
  );
}
