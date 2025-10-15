'use client';
import { useUser } from '@/hooks/useUserContext';
import { Check, Pencil, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Button } from '../ui/button';

export default function AccountInfo() {
  const { user, setUser } = useUser();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  console.log('user', user);

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    console.log('name', name);
    console.log('value', value);
  };
  const handleOnSave = () => {
    setMode('view');
  };

  const input = (
    label: string,
    value: string | undefined,
    disabled: boolean,
    name: string,
    type: string
  ) => {
    return (
      <Input
        type={type}
        placeholder={label}
        value={value}
        disabled={disabled}
        onChange={handleOnChange}
        name={name}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full bg-surface rounded-lg p-4">
      <h1 className="text-2xl font-bold">Account Information</h1>
      <div className="flex items-center justify-start felx-row gap-2 w-full">
        <User className="avatar-lg" />
        <p className="text-sm text-foreground font-bold">
          Username {user?.username}
        </p>
        <Button
          onClick={() => setMode(mode === 'view' ? 'edit' : 'view')}
          variant="ghost"
          className="ml-auto"
        >
          {mode === 'view' ? <Pencil /> : <Check />}
        </Button>
      </div>
      <div className="grid-section-2 w-full">
        <h1 className="text-lg font-bold col-span-2">Personal Details</h1>
        {input(
          'First Name',
          user?.firstName,
          mode === 'view',
          'firstName',
          'text'
        )}
        {input(
          'Last Name',
          user?.lastName,
          mode === 'view',
          'lastName',
          'text'
        )}
        {input('Email', user?.email, mode === 'view', 'email', 'email')}
        {input(
          'Phone Number',
          user?.phoneNumber,
          mode === 'view',
          'phoneNumber',
          'tel'
        )}
        {input(
          'Date of Birth',
          user?.dateOfBirth,
          mode === 'view',
          'dateOfBirth',
          'date'
        )}
        {input('Gender', '', mode === 'view', 'gender', 'text')}
      </div>
      <div className="grid-section-2 w-full">
        <h1 className="text-lg font-bold col-span-2">Address</h1>
        {input('Country', '', mode === 'view', 'country', 'text')}
        {input('City', '', mode === 'view', 'city', 'text')}
        {input('Address', '', mode === 'view', 'address', 'text')}
        {input('Zip Code', '', mode === 'view', 'zipCode', 'text')}
      </div>
    </div>
  );
}
