import { encryptWithHpkePublicKey } from '@/lib/encryption';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormValues } from '@/lib/anonymization/anonymizationHandlers';

export type AnonymizedValues = Partial<
  Record<keyof FormValues, FormValues[keyof FormValues]>
>;

type PrivateDataPayload = {
  userId: string;
  privateData: {
    anonymized_cipher: string | null;
    anonymized_iv: string | null;
    anonymized_encap_pubkey: string | null;
  };
};

type SavePrivateData = (payload: PrivateDataPayload) => Promise<unknown>;

type UseAnonymizedBatchSyncParams = {
  userId?: string;
  hpkePublicKeyB64?: string | null;
  hasPrivateData: boolean;
  addPrivateData: SavePrivateData;
  updatePrivateData: SavePrivateData;
  flushDelayMs?: number;
};

export const useAnonymizedBatchSync = ({
  userId,
  hpkePublicKeyB64,
  hasPrivateData,
  addPrivateData,
  updatePrivateData,
  flushDelayMs = 700,
}: UseAnonymizedBatchSyncParams) => {
  const [anonymizedData, setAnonymizedData] = useState<AnonymizedValues>({});
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncSnapshot = useCallback(
    async (snapshot: AnonymizedValues) => {
      if (!userId) {
        setHasPendingSync(false);
        return;
      }

      const hasSnapshotData = Object.keys(snapshot).length > 0;
      if (hasSnapshotData && !hpkePublicKeyB64) {
        throw new Error('Missing HPKE public key for current user');
      }

      const encryptedData = hasSnapshotData
        ? await encryptWithHpkePublicKey(
            hpkePublicKeyB64 as string,
            JSON.stringify(snapshot)
          )
        : null;

      const payload: PrivateDataPayload = {
        userId,
        privateData: {
          anonymized_cipher: encryptedData?.ciphertextB64 ?? null,
          anonymized_iv: encryptedData?.ivB64 ?? null,
          anonymized_encap_pubkey: encryptedData?.encapPublicKeyB64 ?? null,
        },
      };

      try {
        if (hasPrivateData) {
          await updatePrivateData(payload);
        } else {
          await addPrivateData(payload);
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message.toLowerCase() : '';

        if (!hasPrivateData && message.includes('already exists')) {
          await updatePrivateData(payload);
          setHasPendingSync(false);
          return;
        }

        if (hasPrivateData && message.includes('not found')) {
          await addPrivateData(payload);
          setHasPendingSync(false);
          return;
        }

        throw error;
      }

      setHasPendingSync(false);
    },
    [
      addPrivateData,
      hasPrivateData,
      hpkePublicKeyB64,
      updatePrivateData,
      userId,
    ]
  );

  const scheduleSync = useCallback(
    (nextSnapshot: AnonymizedValues) => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }

      setHasPendingSync(true);

      flushTimeoutRef.current = setTimeout(() => {
        void syncSnapshot(nextSnapshot);
      }, flushDelayMs);
    },
    [flushDelayMs, syncSnapshot]
  );

  const upsertAnonymizedField = useCallback(
    (name: keyof FormValues, value: FormValues[keyof FormValues]) => {
      setAnonymizedData((prev) => {
        const next = {
          ...prev,
          [name]: value,
        };
        scheduleSync(next);
        return next;
      });
    },
    [scheduleSync]
  );

  const removeAnonymizedField = useCallback(
    (name: keyof FormValues) => {
      setAnonymizedData((prev) => {
        if (!(name in prev)) {
          return prev;
        }

        const next = { ...prev };
        delete next[name];
        scheduleSync(next);
        return next;
      });
    },
    [scheduleSync]
  );

  const setAnonymizedSnapshot = useCallback((snapshot: AnonymizedValues) => {
    setAnonymizedData(snapshot);
    setHasPendingSync(false);
  }, []);

  const clearAnonymizedSnapshot = useCallback(() => {
    setAnonymizedData({});
    setHasPendingSync(false);
  }, []);

  const flushAnonymizedNow = useCallback(async () => {
    if (!hasPendingSync) {
      return;
    }

    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }

    await syncSnapshot(anonymizedData);
  }, [anonymizedData, hasPendingSync, syncSnapshot]);

  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, []);

  return {
    upsertAnonymizedField,
    removeAnonymizedField,
    setAnonymizedSnapshot,
    clearAnonymizedSnapshot,
    flushAnonymizedNow,
    hasPendingSync,
    anonymizedData,
  };
};
