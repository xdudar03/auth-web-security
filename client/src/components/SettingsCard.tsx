import { Settings, TriangleAlert } from 'lucide-react';
import { useUser } from '@/hooks/useUserContext';

export default function SettingsCard() {
  const { user } = useUser();
  return (
    <div className="col-span-1 bg-surface rounded-lg h-full overflow-hidden">
      <div className="flex flex-col h-full min-h-0 box-border">
        <div className="flex items-center justify-center gap-2 p-2 w-full mx-auto muted-panel h-40 md:h-2/3">
          <button className="icon-btn-zoom bg-transparent rounded-full w-full h-full">
            <Settings className=" w-full h-1/2 text-muted" />
          </button>
        </div>
        <div className="flex flex-col gap-2 flex-1 min-h-0 box-border p-2 ">
          <h3 className="text-lg font-semibold text-center">Settings</h3>
          {user?.embedding ? (
            <p className="text-sm text-muted-foreground">
              Biometric data registered
            </p>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-2 justify-center">
              <TriangleAlert className="w-4 h-4 text-warning" />
              Biometric data not registered
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
