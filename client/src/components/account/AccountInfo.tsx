'use client';
import { useUser, type User as UserType } from '@/hooks/useUserContext';
import { useEffect, useRef, useState } from 'react';
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
} from '@/lib/anonymization/anonymizationHandlers';
import ProvidersManager from './ProvidersManager';
import {
  decryptWithHpkePrivateKey,
  encryptWithHpkePublicKey,
  getActiveHpkePrivateKeyJwkB64,
  importHpkePrivateKeyJwkB64,
} from '@/lib/encryption/encryption';
import {
  buildAccountFormValues,
  parseDecryptedAnonymizedPayload,
  parseDecryptedUserPayload,
} from '@/lib/accountInfoFormUtils';
import {
  useAnonymizedBatchSync,
  type AnonymizedValues,
} from '@/hooks/useAnonymizedBatchSync';
import { useProviderDataAccessSync } from '@/hooks/useProviderDataAccessSync';

export default function AccountInfo() {
  const { user, shops, privacy, hasPrivateData, privateData } = useUser();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [providerVisibleValues, setProviderVisibleValues] =
    useState<FormValues | null>(null);
  const lastHydrationSignatureRef = useRef<string>('');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

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
    defaultValues: buildAccountFormValues(user, shops),
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  const {
    upsertAnonymizedField,
    removeAnonymizedField,
    setAnonymizedSnapshot,
    clearAnonymizedSnapshot,
    flushAnonymizedNow,
    anonymizedData,
  } = useAnonymizedBatchSync({
    userId: user?.userId,
    hpkePublicKeyB64: user?.hpkePublicKeyB64,
    hasPrivateData,
    addPrivateData: addUserPrivateDataMutation.mutateAsync,
    updatePrivateData: updateUserPrivateDataMutation.mutateAsync,
  });

  const { syncProviderAccessFromForm } = useProviderDataAccessSync({
    userId: user?.userId,
    privacy,
    providerVisibleValues,
    anonymizedData,
    getCurrentFormValues: form.getValues,
  });

  const shopsSignature = shops?.map((shop) => shop.shopName).join('|') ?? '';
  const hydrationSignature = [
    user?.userId ?? '',
    user?.hpkePublicKeyB64 ?? '',
    user?.username ?? '',
    user?.firstName ?? '',
    user?.lastName ?? '',
    user?.emailHash ?? '',
    user?.phoneNumber ?? '',
    user?.dateOfBirth ?? '',
    user?.gender ?? '',
    user?.country ?? '',
    user?.city ?? '',
    user?.address ?? '',
    user?.zip ?? '',
    user?.spendings ?? '',
    user?.shoppingHistory ?? '',
    hasPrivateData ? '1' : '0',
    privateData?.original_cipher ?? '',
    privateData?.original_iv ?? '',
    privateData?.original_encap_pubkey ?? '',
    privateData?.anonymized_cipher ?? '',
    privateData?.anonymized_iv ?? '',
    privateData?.anonymized_encap_pubkey ?? '',
    shopsSignature,
  ].join('|');

  useEffect(() => {
    if (lastHydrationSignatureRef.current === hydrationSignature) {
      return;
    }
    lastHydrationSignatureRef.current = hydrationSignature;

    const resetWithValues = (source: Partial<UserType> | null) => {
      form.reset(buildAccountFormValues(source, shops));
    };

    const loadDecryptedUser = async () => {
      if (!user) {
        clearAnonymizedSnapshot();
        setProviderVisibleValues(buildAccountFormValues(null, shops));
        resetWithValues(null);
        return;
      }

      if (hasPrivateData && user.hpkePublicKeyB64) {
        try {
          const privateKeyJwkB64 = await getActiveHpkePrivateKeyJwkB64();
          if (!privateKeyJwkB64) {
            throw new Error('Missing active HPKE private key in session');
          }

          const privateKey = await importHpkePrivateKeyJwkB64(privateKeyJwkB64);

          if (
            privateData?.anonymized_cipher &&
            privateData?.anonymized_iv &&
            privateData?.anonymized_encap_pubkey
          ) {
            try {
              const decryptedAnonymized = await decryptWithHpkePrivateKey(
                privateKey,
                privateData.anonymized_cipher,
                privateData.anonymized_iv,
                privateData.anonymized_encap_pubkey
              );

              setAnonymizedSnapshot(
                parseDecryptedAnonymizedPayload(decryptedAnonymized)
              );
            } catch {
              clearAnonymizedSnapshot();
            }
          } else {
            clearAnonymizedSnapshot();
          }

          if (
            privateData?.original_cipher &&
            privateData?.original_iv &&
            privateData?.original_encap_pubkey
          ) {
            const decryptedOriginal = await decryptWithHpkePrivateKey(
              privateKey,
              privateData.original_cipher,
              privateData.original_iv,
              privateData.original_encap_pubkey
            );

            const parsedOriginal = parseDecryptedUserPayload(decryptedOriginal);
            resetWithValues(parsedOriginal);
            setProviderVisibleValues(
              buildAccountFormValues(parsedOriginal, shops)
            );
            return;
          }
        } catch (error) {
          console.error('Error decrypting account info', error);
        }
      }

      clearAnonymizedSnapshot();
      setProviderVisibleValues(buildAccountFormValues(user, shops));
      resetWithValues(user);
    };

    void loadDecryptedUser();
  }, [
    clearAnonymizedSnapshot,
    form,
    hasPrivateData,
    hydrationSignature,
    privateData,
    setAnonymizedSnapshot,
    shops,
    user,
  ]);

  const handleOnSave = async (values: FormValues) => {
    if (mode === 'edit') {
      try {
        await flushAnonymizedNow();

        const updates: UserType = {
          ...user,
          ...values,
          roleId: user?.roleId,
        } as UserType;

        const hpkePublicKeyB64 = user?.hpkePublicKeyB64;
        if (!hpkePublicKeyB64) {
          throw new Error('Missing HPKE public key for current user');
        }

        const encryptedData = await encryptWithHpkePublicKey(
          hpkePublicKeyB64,
          JSON.stringify(updates)
        );

        const privateDataPayload = {
          userId: user?.userId ?? '',
          privateData: {
            original_cipher: encryptedData.ciphertextB64,
            original_iv: encryptedData.ivB64,
            original_encap_pubkey: encryptedData.encapPublicKeyB64,
          },
        };

        if (hasPrivateData) {
          await updateUserPrivateDataMutation.mutateAsync(privateDataPayload);
        } else {
          await addUserPrivateDataMutation.mutateAsync(privateDataPayload);
        }

        setProviderVisibleValues(values);
        await syncProviderAccessFromForm(values);
      } catch (error: unknown) {
        console.error('Error saving account info', error);
      }
    }

    setMode((previousMode) => (previousMode === 'view' ? 'edit' : 'view'));
  };

  const handleToggleVisibility = async (
    name: string,
    visibility: 'hidden' | 'anonymized' | 'visible'
  ) => {
    try {
      await toggleUserPrivacyMutation.mutateAsync({
        field: name,
        visibility,
      });
    } catch (error: unknown) {
      console.error('Error toggling user privacy', error);
    }

    const fieldName = name as keyof FormValues;
    if (visibility === 'anonymized') {
      await handleFieldAnonymization(
        name,
        form.getValues,
        form.setValue,
        setMessages
      );

      const nextSnapshot: AnonymizedValues = {
        ...anonymizedData,
        [fieldName]: form.getValues(fieldName),
      };

      upsertAnonymizedField(fieldName, form.getValues(fieldName));
      await syncProviderAccessFromForm(form.getValues(), {
        privacyOverride: { field: name, visibility },
        anonymizedSnapshot: nextSnapshot,
      });
      return;
    }

    removeAnonymizedField(fieldName);

    const nextSnapshot: AnonymizedValues = {
      ...anonymizedData,
    };
    delete nextSnapshot[fieldName];

    await syncProviderAccessFromForm(form.getValues(), {
      privacyOverride: { field: name, visibility },
      anonymizedSnapshot: nextSnapshot,
    });
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
            title="Account Information"
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
