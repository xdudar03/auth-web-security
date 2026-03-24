import { useTRPC } from '@/hooks/TrpcContext';
import {
  buildPrivacyMapWithOverride,
  buildProviderPayload,
  buildVisibilitySignature,
  hasAnySharedField,
  type AnonymizedSnapshot,
  type PrivacyEntry,
} from '@/lib/providerSharing';
import {
  base64ToBytes,
  bytesToBase64,
  encryptWithHpkePublicKey,
} from '@/lib/encryption/encryption';
import type { FormValues } from '@/lib/anonymization/anonymizationHandlers';
import type { Visibility } from '../../../server/src/types/privacySetting';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

type ProviderForSharing = {
  providerId: string;
  hpkePublicKeyB64: string | null;
};

type UseProviderDataAccessSyncParams = {
  userId?: string;
  privacy?: PrivacyEntry[] | null;
  providerVisibleValues: FormValues | null;
  anonymizedData: AnonymizedSnapshot;
  getCurrentFormValues: () => FormValues;
};

export const useProviderDataAccessSync = ({
  userId,
  privacy,
  providerVisibleValues,
  anonymizedData,
  getCurrentFormValues,
}: UseProviderDataAccessSyncParams) => {
  const trpc = useTRPC();
  const lastProviderVisibilitySignatureRef = useRef<string>('');

  const { data: providersForSharingData, refetch: refetchProvidersForSharing } =
    useQuery({
      ...trpc.user.listProvidersForSharing.queryOptions(),
      enabled: Boolean(userId),
    });

  const providersForSharing =
    (providersForSharingData?.providers as ProviderForSharing[] | undefined) ??
    [];

  const setProviderDataAccessMutation = useMutation(
    trpc.user.setProviderDataAccess.mutationOptions({
      onError: (error: unknown) => {
        console.error('Error syncing provider data access', error);
      },
    })
  );

  const hashProviderPublicKey = useCallback(async (publicKeyB64: string) => {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      base64ToBytes(publicKeyB64) as BufferSource
    );

    return bytesToBase64(new Uint8Array(digest));
  }, []);

  const syncProviderAccessFromForm = useCallback(
    async (
      formValues: FormValues,
      options?: {
        privacyOverride?: { field: string; visibility: Visibility };
        anonymizedSnapshot?: AnonymizedSnapshot;
      }
    ) => {
      if (!userId) {
        return;
      }

      let providers = providersForSharing;
      if (!providers.length) {
        const refreshed = await refetchProvidersForSharing();
        providers =
          (refreshed.data?.providers as ProviderForSharing[] | undefined) ?? [];
      }
      if (!providers.length) {
        return;
      }

      const privacyMap = buildPrivacyMapWithOverride(
        privacy ?? [],
        options?.privacyOverride
      );

      const { mode, payload } = buildProviderPayload(
        userId,
        formValues,
        providerVisibleValues,
        options?.anonymizedSnapshot ?? anonymizedData,
        privacyMap
      );

      await Promise.all(
        providers.map(async (provider) => {
          if (mode === 'hidden' || !provider.hpkePublicKeyB64) {
            await setProviderDataAccessMutation.mutateAsync({
              providerId: provider.providerId,
              visibility: 'hidden',
            });
            return;
          }

          const encryptedPayload = await encryptWithHpkePublicKey(
            provider.hpkePublicKeyB64,
            JSON.stringify(payload)
          );
          const providerPublicKeyHash = await hashProviderPublicKey(
            provider.hpkePublicKeyB64
          );

          await setProviderDataAccessMutation.mutateAsync({
            providerId: provider.providerId,
            visibility: mode,
            providerPublicKeyHash,
            userCipher: encryptedPayload.ciphertextB64,
            userIv: encryptedPayload.ivB64,
            userEncapPubKey: encryptedPayload.encapPublicKeyB64,
            userVersion: 1,
          });
        })
      );
    },
    [
      anonymizedData,
      hashProviderPublicKey,
      privacy,
      providerVisibleValues,
      providersForSharing,
      refetchProvidersForSharing,
      setProviderDataAccessMutation,
      userId,
    ]
  );

  useEffect(() => {
    if (!userId) {
      return;
    }

    const privacyMap = buildPrivacyMapWithOverride(privacy ?? []);
    const visibilitySignature = buildVisibilitySignature(privacyMap);

    if (lastProviderVisibilitySignatureRef.current === visibilitySignature) {
      return;
    }
    lastProviderVisibilitySignatureRef.current = visibilitySignature;

    if (!hasAnySharedField(privacyMap)) {
      void syncProviderAccessFromForm(getCurrentFormValues(), {
        anonymizedSnapshot: anonymizedData,
      });
    }
  }, [
    anonymizedData,
    getCurrentFormValues,
    privacy,
    syncProviderAccessFromForm,
    userId,
  ]);

  return {
    syncProviderAccessFromForm,
  };
};
