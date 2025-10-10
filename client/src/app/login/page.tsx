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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-200">
      <div className="flex flex-col items-center justify-center border p-6 bg-white rounded shadow-md border-blue-950 gap-6">
        <div className="flex flex-row items-center justify-center gap-6">
          <button
            onClick={handleBack}
            className="bg-transparent p-2 rounded-full mb-4 hover:bg-gray-200 hover:scale-110 transition"
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
