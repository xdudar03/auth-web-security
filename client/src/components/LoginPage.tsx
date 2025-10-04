'use client';
import LoginForm from '@/components/LoginForm';
import BiometricAuth from '@/components/BiometricAuth';
import { useState } from 'react';
import { UserProvider } from '@/hooks/useUserContext';

export default function LoginPage({
  setPage,
}: {
  setPage: (page: string) => void;
}) {
  const [tab, setTab] = useState('login');
  const handleBack = () => {
    if (tab === 'multi-factor') {
      setTab('login');
    } else {
      setPage('home');
    }
  };
  return (
    <UserProvider>
      <div className="flex flex-row items-center justify-center gap-6">
        <button
          onClick={handleBack}
          className="bg-transparent p-2 rounded-full mb-4 hover:bg-gray-200 hover:scale-110 transition"
        >
          &#8592;
        </button>
        {tab === 'login' ? (
          <LoginForm title="Login" setTab={setTab} />
        ) : (
          <BiometricAuth />
        )}
      </div>
    </UserProvider>
  );
}
