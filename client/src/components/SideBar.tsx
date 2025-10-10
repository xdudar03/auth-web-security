import { LogOut, Settings, User } from 'lucide-react';

export default function SideBar() {
  return (
    <>
      {/* Mobile bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-surface border-t border-border px-4 py-2 flex md:hidden items-center justify-around">
        <button
          aria-label="Profile"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full p-2 hover:bg-muted/20"
        >
          <User className="w-6 h-6" />
        </button>
        <button
          aria-label="Settings"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full p-2 hover:bg-muted/20"
        >
          <Settings className="w-6 h-6" />
        </button>
        <button
          aria-label="Logout"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full p-2 hover:bg-muted/20"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </nav>

      {/* Desktop sidebar */}
      <div className="hidden md:flex bg-surface rounded-lg w-16 lg:w-20 xl:w-28 flex-col gap-4 justify-between items-center p-2 lg:p-4">
        <div className="flex flex-col gap-2 lg:gap-4">
          <button
            aria-label="Profile"
            className="hover:scale-110 transition cursor-pointer hover:bg-muted/20 rounded-full p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <User className="w-6 h-6" />
          </button>
          <button
            aria-label="Settings"
            className="hover:scale-110 transition cursor-pointer hover:bg-muted/20 rounded-full p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
        <button
          aria-label="Logout"
          className="hover:scale-110 transition cursor-pointer hover:bg-muted/20 rounded-full p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </div>
    </>
  );
}
