'use client';
import { useUser } from '@/hooks/useUserContext';
import { AccountHeader } from './AccountHeader';
import { useState } from 'react';
import { useDecryptedPrivateProfile } from '@/hooks/useDecryptedPrivateProfile';
import ShopInfo from './ShopInfo';

export default function ProviderAccount() {
  const { shops } = useUser();
  const decryptedData = useDecryptedPrivateProfile();
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const handleProviderFormSubmit = (
    event: React.FormEvent<HTMLFormElement>
  ) => {
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
