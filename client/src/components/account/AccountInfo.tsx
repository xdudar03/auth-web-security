'use client';
import { useUser, type User as UserType } from '@/hooks/useUserContext';
import { Check, Pencil, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Button } from '../ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '../ui/form';
import { useForm } from 'react-hook-form';
import { changeUserInfo } from '@/lib/admin/changeUserInfo';

export default function AccountInfo() {
  const { user, setUser } = useUser();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  console.log('user', user);

  const handleOnSave = async (values: FormValues) => {
    if (mode === 'edit') {
      try {
        const updates: UserType = {
          ...user,
          ...values,
          roleId: user?.roleId,
        } as UserType;
        console.log('updates', updates);
        const result = await changeUserInfo(user?.id ?? '', updates);
        console.log('result', result);
        if (result) {
          setUser(result.user as UserType);
          console.log('user', user);
        }
      } catch (error) {
        console.error('Error saving account info', error);
      }
    }
    setMode(mode === 'view' ? 'edit' : 'view');
  };

  const form = useForm<FormValues>({
    defaultValues: {
      username: user?.username,
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email,
      phoneNumber: user?.phoneNumber ?? '',
      dateOfBirth: user?.dateOfBirth ?? '',
      // gender: '',
      // country: '',
      // city: '',
      // address: '',
      // zipCode: '',
    },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  type FormValues = {
    username: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phoneNumber: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    country: string | null;
    city: string | null;
    address: string | null;
    zipCode: string | null;
  };

  const input = (
    label: string,
    disabled: boolean,
    name: keyof FormValues,
    type: string
  ) => {
    return (
      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input
                {...field}
                type={type}
                placeholder={label}
                value={field.value ?? ''}
                disabled={disabled}
                // onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full bg-surface rounded-lg p-4">
      <Form {...form}>
        <form id="account-info-form" onSubmit={form.handleSubmit(handleOnSave)}>
          <h1 className="text-2xl font-bold">Account Information</h1>
          <div className="flex items-center justify-start felx-row gap-2 w-full">
            <User className="avatar-lg" />
            <p className="text-sm text-foreground font-bold">
              Username {user?.username}
            </p>
            <Button
              variant="ghost"
              className="ml-auto"
              form="account-info-form"
              type="submit"
            >
              {mode === 'view' ? <Pencil /> : <Check />}
            </Button>
          </div>
          <div className="grid-section-2 w-full">
            <h1 className="text-lg font-bold col-span-2">Personal Details</h1>
            {input('First Name', mode === 'view', 'firstName', 'text')}
            {input('Last Name', mode === 'view', 'lastName', 'text')}
            {input('Email', mode === 'view', 'email', 'email')}
            {input('Phone Number', mode === 'view', 'phoneNumber', 'tel')}
            {input('Date of Birth', mode === 'view', 'dateOfBirth', 'date')}
            {input('Gender', mode === 'view', 'gender', 'text')}
          </div>
          <div className="grid-section-2 w-full">
            <h1 className="text-lg font-bold col-span-2">Address</h1>
            {input('Country', mode === 'view', 'country', 'text')}
            {input('City', mode === 'view', 'city', 'text')}
            {input('Address', mode === 'view', 'address', 'text')}
            {input('Zip Code', mode === 'view', 'zipCode', 'text')}
          </div>
        </form>
      </Form>
    </div>
  );
}
