'use client';
import FormAuth from '@/components/authentication/FormAuth';
import BiometricAuth from '@/components/authentication/BiometricAuth';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

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
          <button onClick={handleBack} className="icon-btn-zoom ">
            <ArrowLeft />
          </button>
          {tab === 'login' ? (
            <FormAuth title="Login" setTab={setTab} />
          ) : (
            <BiometricAuth title="Login" action="login" />
          )}
        </div>
      </div>
    </div>
  );
}
