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
  masking,
  namePseudonymization,
  suppression,
} from '@/lib/anonymization/anonimizationData';
import { faker } from '@faker-js/faker';
import { Visibility } from '../../../../server/src/types/privacySetting';
import {
  anonymizeCity,
  anonymizeCountry,
  anonymizeStreet,
} from '@/lib/anonymization/anonymizationAddress';

export default function AccountInfo() {
  const { user, shops, privacy } = useUser();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [messages, setMessages] = useState<Record<string, string>>({});
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
      onError: (error: unknown) => {
        console.error(
          'Error updating user',
          error instanceof Error ? error.message : 'Unknown error'
        );
      },
    })
  );
  const toggleUserPrivacyMutation = useMutation(
    trpc.privacy.toggleUserPrivacyService.mutationOptions({
      onSuccess: (data: { field: string; visibility: Visibility }) => {
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
      } catch (error: unknown) {
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
      } catch (error: unknown) {
        console.error('Error toggling user privacy', error);
      }
      if (visibility === 'anonymized') {
        switch (name) {
          case 'firstName':
            const anonFirstName = namePseudonymization().firstName;
            form.setValue('firstName', anonFirstName);
            setMessages((prev) => ({
              ...prev,
              [name]: 'Anonymized value: ' + anonFirstName,
            }));
            break;
          case 'lastName':
            const anonLastName = namePseudonymization().lastName;
            form.setValue('lastName', anonLastName);
            setMessages((prev) => ({
              ...prev,
              [name]: 'Anonymized value: ' + anonLastName,
            }));
            break;
          case 'email':
            const anonEmail = masking(form.getValues('email'));
            form.setValue('email', anonEmail);
            setMessages((prev) => ({
              ...prev,
              [name]: 'Anonymized value: ' + anonEmail,
            }));
            break;
          case 'phoneNumber':
            const anonPhone = masking(form.getValues('phoneNumber') ?? '');
            form.setValue('phoneNumber', anonPhone);
            setMessages((prev) => ({
              ...prev,
              [name]: 'Anonymized value: ' + anonPhone,
            }));
            break;
          case 'dateOfBirth':
            const anonDOB = faker.date.birthdate().toISOString();
            form.setValue('dateOfBirth', anonDOB);
            setMessages((prev) => ({
              ...prev,
              [name]: 'Anonymized value: ' + anonDOB,
            }));
            break;
          case 'gender':
            const anonGender = suppression();
            form.setValue('gender', anonGender);
            setMessages((prev) => ({
              ...prev,
              [name]: 'Anonymized value: ' + anonGender,
            }));
            break;
          case 'zip':
            const anonZip = masking(form.getValues('zip') ?? '');
            form.setValue('zip', anonZip);
            setMessages((prev) => ({
              ...prev,
              [name]: 'Anonymized value: ' + anonZip,
            }));
            break;
          case 'country':
            const country = form.getValues('country') ?? '';
            const anonymizedCountry = anonymizeCountry(country);
            console.log('anonymizedCountry', anonymizedCountry);
            if (anonymizedCountry) {
              setMessages((prev) => ({
                ...prev,
                [name]: 'Anonymized value: ' + anonymizedCountry,
              }));
            } else {
              setMessages((prev) => ({ ...prev, [name]: 'No country found' }));
              form.setValue('country', suppression());
            }
            break;
          case 'city':
            const city = form.getValues('city') ?? '';
            const anonymizedCity = await anonymizeCity(city);
            console.log('anonymizedCity', anonymizedCity);
            if (anonymizedCity.length > 0) {
              setMessages((prev) => ({
                ...prev,
                [name]: 'Anonymized value: ' + anonymizedCity[0].country,
              }));
            } else {
              setMessages((prev) => ({ ...prev, [name]: 'No city found' }));
              form.setValue('city', suppression());
            }
            break;
          case 'address':
            const street = form.getValues('address') ?? '';
            const anonymizedStreet = await anonymizeStreet(street);
            console.log('anonymizedStreet', anonymizedStreet);
            if (anonymizedStreet.length > 0) {
              // TODO: better error handling and validation
              setMessages((prev) => ({
                ...prev,
                [name]: 'Anonymized value: ' + anonymizedStreet[0].city,
              }));
            } else {
              setMessages((prev) => ({ ...prev, [name]: 'No street found' }));
              form.setValue('address', suppression());
            }
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
              <div className="flex flex-col gap-2">
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
                {messages[name as string] && (
                  <p className="text-sm text-muted-foreground">
                    {messages[name as string]}
                  </p>
                )}
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
          <div className="grid-section-2 w-full ">
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
