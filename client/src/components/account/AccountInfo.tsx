'use client';
import { Shop, useUser, type User as UserType } from '@/hooks/useUserContext';
import { useEffect, useState } from 'react';
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
import {
  decryptWithDek,
  encryptWithDek,
  exportRawKeyB64,
  generateDek,
  importRawAesKey,
} from '@/lib/encryption';

export default function AccountInfo() {
  const { user, shops, privacy, hasPrivateData, privateData } = useUser();
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

  const addUserPrivateDataMutation = useMutation(
    trpc.user.addUserPrivateData.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.info.getUserInfo.queryOptions().queryKey,
        });
      },
      onError: (error: unknown) => {
        console.error('Error adding user private data', error);
      },
    })
  );

  const updateUserPrivateDataMutation = useMutation(
    trpc.user.updateUserPrivateData.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.info.getUserInfo.queryOptions().queryKey,
        });
      },
      onError: (error: unknown) => {
        console.error('Error updating user private data', error);
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

  useEffect(() => {
    const resetWithValues = (source: Partial<UserType> | null) => {
      form.reset({
        username: source?.username ?? '',
        shops: shops?.map((shop: Shop) => shop.shopName) ?? [],
        firstName: source?.firstName ?? '',
        lastName: source?.lastName ?? '',
        email: source?.email ?? '',
        phoneNumber: source?.phoneNumber ?? '',
        dateOfBirth: source?.dateOfBirth ?? '',
        gender: source?.gender ?? '',
        country: source?.country ?? '',
        city: source?.city ?? '',
        address: source?.address ?? '',
        zip: source?.zip ?? '',
        spendings: source?.spendings ?? '',
        shoppingHistory: source?.shoppingHistory ?? '',
      });
    };

    const loadDecryptedUser = async () => {
      if (!user) {
        resetWithValues(null);
        return;
      }

      if (
        hasPrivateData &&
        user.dekB64 &&
        privateData?.original_cipher &&
        privateData?.original_iv
      ) {
        try {
          const key = await importRawAesKey(user.dekB64);
          const decrypted = await decryptWithDek(
            key,
            privateData.original_cipher,
            privateData.original_iv
          );
          const parsed = (() => {
            try {
              return JSON.parse(decrypted) as Partial<UserType>;
            } catch {
              return { email: decrypted } as Partial<UserType>;
            }
          })();
          resetWithValues(parsed);
          return;
        } catch (error) {
          console.error('Error decrypting account info', error);
        }
      }

      resetWithValues(user);
    };

    loadDecryptedUser();
  }, [form, hasPrivateData, privateData, shops, user]);

  const handleOnSave = async (values: FormValues) => {
    if (mode === 'edit') {
      try {
        const updates: UserType = {
          ...user,
          ...values,
          roleId: user?.roleId,
        } as UserType;

        let dekB64 = user?.dekB64 ?? null;
        if (!dekB64) {
          const newDek = await generateDek();
          dekB64 = await exportRawKeyB64(newDek);
        }

        const key = await importRawAesKey(dekB64);
        const encryptedData = await encryptWithDek(
          key,
          JSON.stringify(updates)
        );

        if (!user?.dekB64) {
          await updateUserMutation.mutateAsync({
            userId: user?.userId ?? '',
            updates: {
              dekB64,
            },
          });
        }

        const privateDataPayload = {
          userId: user?.userId ?? '',
          privateData: {
            original_cipher: encryptedData.ciphertextB64,
            original_iv: encryptedData.ivB64,
          },
        };

        if (hasPrivateData) {
          await updateUserPrivateDataMutation.mutateAsync(privateDataPayload);
        } else {
          await addUserPrivateDataMutation.mutateAsync(privateDataPayload);
        }
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
            username={form.watch('username')}
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
