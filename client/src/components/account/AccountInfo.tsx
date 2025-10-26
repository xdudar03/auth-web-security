'use client';
import { Shop, useUser, type User as UserType } from '@/hooks/useUserContext';
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
import { useTRPC } from '@/hooks/TrpcContext';
import { useMutation } from '@tanstack/react-query';

export default function AccountInfo() {
  const { user, shops } = useUser();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const trpc = useTRPC();
  const updateUserMutation = useMutation(
    trpc.admin.updateUser.mutationOptions({
      onSuccess: () => {
        setMode('view');
      },
      onError: (error) => {
        console.error('Error updating user', error);
      },
    })
  );

  const handleOnSave = async (values: FormValues) => {
    if (mode === 'edit') {
      try {
        const updates: UserType = {
          ...user,
          ...values,
          roleId: user?.roleId,
        } as UserType;
        await updateUserMutation.mutateAsync({
          userId: user?.userId ?? '',
          updates: updates,
        });
      } catch (error) {
        console.error('Error saving account info', error);
      }
    }
    setMode(mode === 'view' ? 'edit' : 'view');
  };

  const form = useForm<FormValues>({
    defaultValues: {
      username: user?.username,
      shops: shops?.map((shop: Shop) => shop.shopName),
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
    shops: string[];
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
        <form
          id="account-info-form"
          onSubmit={form.handleSubmit(handleOnSave)}
          className="flex flex-col gap-2"
        >
          <h1 className="text-2xl font-bold">Account Information</h1>
          <div className="flex items-center justify-start flex-row gap-2 w-full">
            <User className="avatar-lg" />
            <div className="flex items-start justify-start flex-col gap-2">
              <p className="text-sm text-foreground font-bold">
                Username: {user?.username}
              </p>
              <p className="text-sm text-foreground font-bold">
                Shops: {shops?.map((shop: Shop) => shop.shopName).join(', ')}
              </p>
            </div>
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
