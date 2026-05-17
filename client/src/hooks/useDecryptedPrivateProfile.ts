'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/hooks/useUserContext';
import {
  loadDecryptedUser,
  type DecryptedPrivateProfile,
} from '@/lib/encryption/loadDecrypted';

export function useDecryptedPrivateProfile() {
  const { user, privateData } = useUser();
  const [decryptedData, setDecryptedData] =
    useState<DecryptedPrivateProfile | null>(null);

  useEffect(() => {
    const loadDecryptedData = async () => {
      if (!user || !privateData) {
        setDecryptedData(null);
        return;
      }

      const result = await loadDecryptedUser(user, privateData);
      setDecryptedData(result);
    };

    void loadDecryptedData();
  }, [privateData, user]);

  return decryptedData;
}
