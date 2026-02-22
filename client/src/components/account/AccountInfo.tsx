'use client';
import { Shop, useUser, type User as UserType } from '@/hooks/useUserContext';
import { useState } from 'react';
import { Form } from '../ui/form';
import { useForm } from 'react-hook-form';
import { useTRPC } from '@/hooks/TrpcContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Visibility } from '../../../../server/src/types/privacySetting';
import { AccountHeader } from './AccountHeader';
import { PersonalDetailsSection } from './PersonalDetailsSection';
import { AddressSection } from './AddressSection';
import {
  handleFieldAnonymization,
  type FormValues,
} from '../../lib/anonymization/anonymizationHandlers';
import ProvidersManager from './ProvidersManager';
import { generateDek, encryptWithDek, decryptWithDek } from '@/lib/encryption';

// store wrappedDek + wrapIv + salt (+ params), never store password

export default function AccountInfo() {
  const { user, shops, privacy } = useUser();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [messages, setMessages] = useState<Record<string, string>>({});
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const updateUserMutation = useMutation(
    trpc.user.updateProfile.mutationOptions({
      onSuccess: () => {
        setMode('view');
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
        console.log(`this field ${data.field} is now ${data.visibility}`);
        queryClient.invalidateQueries({
          queryKey: trpc.info.getUserInfo.queryOptions().queryKey,
        });
      },
      onError: (error) => {
        console.error('Error toggling user privacy', error);
      },
    })
  );

  const form = useForm<FormValues>({
    defaultValues: {
      username: user?.username ?? '',
      shops: shops?.map((shop: Shop) => shop.shopName) ?? [],
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
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

  const handleOnSave = async (values: FormValues) => {
    if (mode === 'edit') {
      try {
        const updates: UserType = {
          ...user,
          ...values,
          roleId: user?.roleId,
        } as UserType;
        console.log('original data', updates);
        const key = await generateDek();
        const encryptedData = await encryptWithDek(
          key,
          JSON.stringify(updates)
        );
        console.log('encryptedData', encryptedData);
        await updateUserMutation.mutateAsync({
          userId: user?.userId ?? '',
          updates: updates,
        });
        const decryptedData = await decryptWithDek(
          key,
          encryptedData.ciphertextB64,
          encryptedData.ivB64
        );
        console.log('decryptedData', decryptedData);
      } catch (error: unknown) {
        console.error('Error saving account info', error);
      }
    }
    setMode(mode === 'view' ? 'edit' : 'view');
  };

  const handleToggleVisibility = async (
    name: string,
    visibility: 'hidden' | 'anonymized' | 'visible'
  ) => {
    try {
      await toggleUserPrivacyMutation.mutateAsync({
        field: name,
        visibility: visibility,
      });
    } catch (error: unknown) {
      console.error('Error toggling user privacy', error);
    }
    if (visibility === 'anonymized') {
      await handleFieldAnonymization(
        name,
        form.getValues,
        form.setValue,
        setMessages
      );
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full bg-surface rounded-lg p-4">
      <Form {...form}>
        <form
          id="account-info-form"
          onSubmit={form.handleSubmit(handleOnSave)}
          className="flex flex-col gap-2"
        >
          <AccountHeader
            username={user?.username}
            shops={shops}
            isEditMode={mode === 'edit'}
            onModeToggle={() => setMode(mode === 'view' ? 'edit' : 'view')}
          />
          <PersonalDetailsSection
            control={form.control}
            isViewMode={mode === 'view'}
            privacy={privacy}
            messages={messages}
            onToggleVisibility={handleToggleVisibility}
          />
          <AddressSection
            control={form.control}
            isViewMode={mode === 'view'}
            privacy={privacy}
            messages={messages}
            onToggleVisibility={handleToggleVisibility}
          />
          <ProvidersManager />
        </form>
      </Form>
    </div>
  );
}
