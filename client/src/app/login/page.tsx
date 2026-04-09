'use client';
import FormAuth from '@/components/authentication/FormAuth';
import BiometricAuth from '@/components/authentication/biometric/BiometricAuth';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const router = useRouter();

  const handleBack = () => {
    if (tab === 'biometric' || tab === 'send-code') {
      setTab('login');
    } else {
      router.push('/');
    }
  };
  return (
    <div className="center-screen">
      <div className="card">
        <div className="flex flex-row items-center justify-center gap-6">
          <Button
            onClick={handleBack}
            variant="ghost"
            size="icon"
            className="icon-btn-zoom "
          >
            <ArrowLeft />
          </Button>
          {tab === 'biometric' ? (
            <BiometricAuth title="Login" action="login" />
          ) : (
            <FormAuth title="Login" setTab={setTab} tab={tab} />
          )}
        </div>
      </div>
    </div>
  );
}
