import { Settings, User } from 'lucide-react';
import { useUser } from '@/hooks/useUserContext';
import SideBar from './SideBar';

export default function Dashboard() {
  const { user } = useUser();
  return (
    <div className="flex max-h-screen bg-background w-full gap-4 p-2 sm:p-4 pb-16 md:pb-4 flex-col md:flex-row  mx-auto">
      <SideBar />
      {/* Dashboard cards */}
      <div className="grid w-full gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
        {/* Account info */}
        <div className="col-span-1 bg-surface rounded-lg h-full overflow-hidden">
          <div className="flex flex-col h-full min-h-0 box-border">
            {/* User photo */}
            <div className="flex items-center justify-center gap-2 p-2 w-full mx-auto bg-muted/20 h-40 md:h-2/3">
              <User className="w-1/2 h-1/2 text-muted" />
            </div>
            <div className="flex flex-col gap-2 flex-1 min-h-0 box-border p-2 ">
              <h3 className="text-lg font-semibold text-center">
                Account Info
              </h3>
              <p className="text-sm text-muted-foreground">
                Username: {user?.username}
              </p>
              <p className="text-sm text-muted-foreground">
                Full name: Full Name
              </p>
              <p className="text-sm text-muted-foreground">Email: Email</p>
            </div>
          </div>
        </div>
        {/* Settings */}
        <div className="col-span-1 bg-surface rounded-lg h-full overflow-hidden">
          <div className="flex flex-col h-full min-h-0 box-border">
            <div className="flex items-center justify-center gap-2 p-2 w-full mx-auto bg-muted/20 h-40 md:h-2/3">
              <button className="hover:scale-110 transition cursor-pointer rounded-full w-full h-full">
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
                <p className="text-sm text-muted-foreground">
                  Biometric data not registered
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="col-span-1 bg-surface rounded-lg"></div>

        <div className="lg:col-span-2 bg-surface rounded-lg"></div>
        <div className="col-span-1 bg-surface rounded-lg"></div>
      </div>
    </div>
  );
}
