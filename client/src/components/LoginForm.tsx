'use client';

import { useEffect } from 'react';
import { handleRegisterPasswordless } from '@/lib/registrationPasswordless';
import { handleAuthenticatePasswordless } from '@/lib/authenticationPasswordless';
import { useUser, type User } from '@/hooks/useUserContext';

export default function LoginForm({
  setTab,
  title,
}: {
  setTab: (tab: string) => void;
  title: string;
}) {
  const { user, setUser } = useUser();

  useEffect(() => {
    console.log('user updated', user);
  }, [user]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    setUser({ ...(user ?? {}), id: id } as User);
    if (user?.username === '') {
      alert('Username is required');
      return;
    }
    if (user?.password === '') {
      alert('Password is required');
      return;
    }
    setTab('multi-factor');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'username') {
      setUser({ ...(user ?? {}), username: value } as User);
    } else if (name === 'password') {
      setUser({ ...(user ?? {}), password: value } as User);
    }
  };

  const handlePasswordless = () => {
    if (user?.username === '') {
      alert('Username is required');
      return;
    }
    if (title === 'Registration') {
      const id = crypto.randomUUID();
      console.log('id', id);
      setUser({ ...(user ?? {}), id: id } as User);
      if (user?.username) {
        handleRegisterPasswordless(user.username, user.credentials, id);
      } else {
        alert('Username is required');
      }
    } else {
      if (user?.username) {
        handleAuthenticatePasswordless(user.username, user.id);
      } else {
        alert('Username is required');
      }
    }
  };
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded  gap-6">
      <h2 className="text-lg font-semibold">{title} Form</h2>
      <form onSubmit={onSubmit} className="flex flex-col space-y-4">
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
        <button
          type="button"
          className=" text-sm align-self-start hover:underline cursor-pointer"
          onClick={handlePasswordless}
        >
          Use passwordless {title.toLowerCase()}
        </button>
        <button
          type="submit"
          className="bg-blue-900 text-white p-2 rounded cursor-pointer"
        >
          {title}
        </button>
      </form>
    </div>
  );
}
