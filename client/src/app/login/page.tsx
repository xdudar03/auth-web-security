'use client';
import FormAuth from '@/components/FormAuth';
import BiometricAuth from '@/components/BiometricAuth';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const router = useRouter();

  const handleBack = () => {
    if (tab === 'multi-factor') {
      setTab('login');
    } else {
      router.push('/');
    }
  };
  return (
    <div className="center-screen">
      <div className="card">
        <div className="flex flex-row items-center justify-center gap-6">
          <button
            onClick={handleBack}
            className="icon-btn-zoom bg-transparent mb-4"
          >
            &#8592;
          </button>
          {tab === 'login' ? (
            <FormAuth title="Login" setTab={setTab} />
          ) : (
            <BiometricAuth title="Login" />
          )}
        </div>
      </div>
    </div>
  );
}
