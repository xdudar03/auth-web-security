'use client';

import { useState } from 'react';
import LoginForm from './LoginForm';
import BiometricAuth from './BiometricAuth';
import { UserProvider } from '@/hooks/useUserContext';

export default function RegistrationPage({
  setPage,
}: {
  setPage: (page: string) => void;
}) {
  const [tab, setTab] = useState('registration');
  const handleBack = () => {
    if (tab === 'multi-factor') {
      setTab('registration');
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
        {tab === 'registration' ? (
          <LoginForm title="Registration" setTab={setTab} />
        ) : (
          <BiometricAuth title="Registration" />
        )}
      </div>
    </UserProvider>
  );
}
