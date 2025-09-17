'use client';
import LoginPage from '@/components/LoginPage';
import RegistrationPage from '@/components/RegistrationPage';
import { useState } from 'react';

export default function Home() {
  const [page, setPage] = useState('home');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-200">
      <div className="flex flex-col items-center justify-center border p-6 bg-white rounded shadow-md border-blue-950 gap-6">
        {page === 'login' && <LoginPage setPage={setPage} />}
        {page === 'registration' && <RegistrationPage setPage={setPage} />}
        {page === 'home' && (
          <>
            <h3 className="text-2xl font-bold">Authentication Page</h3>
            <div className="flex flex-col gap-6 w-full">
              <button
                onClick={() => setPage('login')}
                className="bg-blue-900 text-white p-2 rounded"
              >
                Login
              </button>
              <button
                onClick={() => setPage('registration')}
                className="bg-blue-900 text-white p-2 rounded"
              >
                Registration
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
