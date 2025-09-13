'use client';
import LoginForm from '@/components/LoginForm';
import MultiFactorAuth from '@/components/MultiFactorAuth';
import { useState } from 'react';

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-200">
      {tab === 'login' ? <LoginForm setTab={setTab} /> : <MultiFactorAuth />}
    </div>
  );
}
