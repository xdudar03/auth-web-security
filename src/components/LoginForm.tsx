'use client';

import { useState } from 'react';

export default function LoginForm({
  setTab,
}: {
  setTab: (tab: string) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTab('multi-factor');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'username') {
      setUsername(value);
    } else if (name === 'password') {
      setPassword(value);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center border p-6 bg-white rounded shadow-md border-blue-950 gap-6">
      <h2 className="text-lg font-semibold">Login Form</h2>
      <form onSubmit={onSubmit} className="flex flex-col space-y-4 ">
        <label>
          <input
            type="text"
            name="username"
            onChange={handleChange}
            className="border p-2 rounded"
            placeholder="Username"
          />
        </label>
        <label>
          <input
            type="password"
            name="password"
            onChange={handleChange}
            className="border p-2 rounded"
            placeholder="Password"
          />
        </label>
        <button type="submit" className="bg-blue-900 text-white p-2 rounded">
          Login
        </button>
      </form>
    </div>
  );
}
