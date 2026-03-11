'use client';
import { useUser } from '@/hooks/useUserContext';
import { AccountHeader } from './AccountHeader';
import { useEffect, useState } from 'react';
import {
  loadDecryptedUser,
  DecryptedPrivateProfile,
} from '@/lib/loadDecrypted';
import ShopInfo from './ShopInfo';

export default function ProviderAccount() {
  const { user, shops, privateData } = useUser();
  const [decryptedData, setDecryptedData] =
    useState<DecryptedPrivateProfile | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  useEffect(() => {
    const loadDecryptedData = async () => {
      if (!user || !privateData) {
        setDecryptedData(null);
        return;
      }
      const decryptedData = await loadDecryptedUser(user, privateData);
      if (!decryptedData) {
        return;
      }
      setDecryptedData(decryptedData);
    };
    void loadDecryptedData();
  }, [privateData, user]);

  const handleProviderFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMode((previousMode) => (previousMode === 'view' ? 'edit' : 'view'));
  };

  return (
    <div className="flex flex-col gap-4 w-full bg-surface rounded-lg p-4">
      <form
        id="account-info-form"
        onSubmit={handleProviderFormSubmit}
        className="flex flex-col gap-2"
      >
        <AccountHeader
          username={decryptedData?.username ?? '-'}
          shops={shops}
          isEditMode={mode === 'edit'}
          title="Provider Account"
          onModeToggle={() => setMode(mode === 'view' ? 'edit' : 'view')}
        />
        <ShopInfo isViewMode={mode === 'view'} />
      </form>
    </div>
  );
}
