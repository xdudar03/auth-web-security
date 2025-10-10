'use client';

import { useState } from 'react';
import FormAuth from '@/components/FormAuth';
import { useRouter } from 'next/navigation';

export default function RegistrationPage() {
  const [tab, setTab] = useState('registration');
  const router = useRouter();

  const handleBack = () => {
    if (tab === 'multi-factor') {
      setTab('registration');
    } else {
      router.push('/');
    }
  };
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center justify-center border p-6 bg-surface rounded shadow-md border-border gap-6">
        <div className="flex flex-row items-center justify-center gap-6">
          <button
            onClick={handleBack}
            className="bg-transparent p-2 rounded-full mb-4 hover:bg-muted/20 hover:scale-110 transition"
          >
            &#8592;
          </button>
          <FormAuth title="Registration" setTab={setTab} />
          {/* <BiometricAuth title="Registration" /> */}
        </div>
      </div>
    </div>
  );
}
