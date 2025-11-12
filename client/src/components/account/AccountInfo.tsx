'use client';
import {
  PrivacySettings,
  Shop,
  useUser,
  type User as UserType,
} from '@/hooks/useUserContext';
import { Check, Eye, EyeClosed, HatGlasses, Pencil, User } from 'lucide-react';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  ageGeneralization,
  masking,
  namePseudonymization,
  suppression,
} from '@/lib/anonymization/anonimizationData';
import { faker } from '@faker-js/faker';

export default function AccountInfo() {
  const { user, shops, privacy } = useUser();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const updateUserMutation = useMutation(
    trpc.admin.updateUser.mutationOptions({
      onSuccess: () => {
        setMode('view');
        // Refresh user info so context reflects latest data immediately
        queryClient.invalidateQueries({
          queryKey: trpc.info.getUserInfo.queryOptions().queryKey,
        });
      },
      onError: (error) => {
        console.error('Error updating user', error);
      },
    })
  );
  const toggleUserPrivacyMutation = useMutation(
    trpc.privacy.toggleUserPrivacyService.mutationOptions({
      onSuccess: (data) => {
        console.log(`this fiels ${data.field} is now ${data.visibility}`);
        queryClient.invalidateQueries({
          queryKey: trpc.info.getUserInfo.queryOptions().queryKey,
        });
      },
      onError: (error) => {
        console.error('Error toggling user privacy', error);
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
      gender: user?.gender ?? '',
      country: user?.country ?? '',
      city: user?.city ?? '',
      address: user?.address ?? '',
      zip: user?.zip ?? '',
      spendings: user?.spendings ?? '',
      shoppingHistory: user?.shoppingHistory ?? '',
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
    zip: string | null;
    spendings: string | null;
    shoppingHistory: string | null;
  };

  const handleToggleVisibility =
    (name: string, visibility: 'hidden' | 'anonymized' | 'visible') =>
    async () => {
      try {
        await toggleUserPrivacyMutation.mutateAsync({
          field: name,
          visibility: visibility,
        });
      } catch (error) {
        console.error('Error toggling user privacy', error);
      }
      if (visibility === 'anonymized') {
        switch (name) {
          case 'firstName':
            form.setValue('firstName', namePseudonymization().firstName);
            break;
          case 'lastName':
            form.setValue('lastName', namePseudonymization().lastName);
            break;
          case 'email':
            form.setValue('email', masking(form.getValues('email')));
            break;
          case 'dateOfBirth':
            form.setValue(
              'dateOfBirth',
              ageGeneralization(form.getValues('dateOfBirth') ?? '')
            );
            break;
          case 'phoneNumber':
            form.setValue(
              'phoneNumber',
              masking(form.getValues('phoneNumber') ?? '')
            );
            break;
          case 'zip':
            form.setValue('zip', masking(form.getValues('zip') ?? ''));
            break;
          case 'dateOfBirth':
            // form.setValue('dateOfBirth', ageGeneralization(form.getValues('dateOfBirth') ?? ''));
            form.setValue('dateOfBirth', faker.date.birthdate().toISOString());
            break;
          case 'gender':
            form.setValue('gender', suppression());
            break;
          case 'country':
            form.setValue('country', suppression());
            break;
          case 'city':
            form.setValue('city', suppression());
            break;
          case 'address':
            form.setValue('address', suppression());
            break;
        }
      }
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
              <div className="flex items-center justify-start flex-row gap-2">
                <Input
                  {...field}
                  type={type}
                  placeholder={label}
                  value={field.value ?? ''}
                  disabled={disabled}
                />
                {privacy?.find(
                  (p: PrivacySettings) => p.field === (name as string)
                )?.visibility === 'visible' ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleToggleVisibility(name, 'hidden')}
                      >
                        <Eye />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Hide this field</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleToggleVisibility(name, 'visible')}
                      >
                        <EyeClosed />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Show this field</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleToggleVisibility(name, 'anonymized')}
                    >
                      <HatGlasses />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Anonymize this field</p>
                  </TooltipContent>
                </Tooltip>
              </div>
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
            {input('Zip Code', mode === 'view', 'zip', 'text')}
          </div>
        </form>
      </Form>
    </div>
  );
}
