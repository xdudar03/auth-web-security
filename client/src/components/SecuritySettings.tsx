import { useUser } from '@/hooks/useUserContext';
import { useState } from 'react';
import ChangePasswordForm from './ChangePasswordForm';

export default function SecuritySettings() {
  const { user } = useUser();
  const isBiometric = user?.embedding !== '';
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  return (
    <div className="grid-section-2 w-full">
      <h1 className="text-lg font-bold col-span-2">Security Settings</h1>
      <div className="flex flex-col gap-2">
        <button
          className="btn-outline"
          onClick={() => setShowChangePasswordModal(true)}
        >
          Change Password
        </button>
        {showChangePasswordModal && (
          <ChangePasswordForm
            setShowChangePasswordModal={setShowChangePasswordModal}
          />
        )}
        {isBiometric ? (
          <button className="btn-outline">Change Biometric</button>
        ) : (
          <>
            <p>
              Biometric data not registered, please register to use biometric
              authentication.
            </p>
            <button className="btn-outline bg-warning hover:bg-warning/90 border-warning">
              Register Biometric
            </button>
          </>
        )}
      </div>
    </div>
  );
}
