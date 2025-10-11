import { useUser } from '@/hooks/useUserContext';

export default function SecuritySettings() {
  const { user } = useUser();
  const isBiometric = user?.embedding !== '';

  return (
    <div className="grid-section-2 w-full">
      <h1 className="text-lg font-bold col-span-2">Security Settings</h1>
      <div className="flex flex-col gap-2">
        <button className="btn-outline">Change Password</button>
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
