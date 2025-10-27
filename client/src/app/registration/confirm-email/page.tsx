'use client';

import { useSearchParams } from 'next/navigation';
import ConfirmEmailModal from '@/components/authentication/ConfirmEmailModal';

export default function ConfirmEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  console.log('token: ', token);
  return <ConfirmEmailModal token={token} />;
}
