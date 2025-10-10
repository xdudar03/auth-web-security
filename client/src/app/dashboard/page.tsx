'use client';
import { useUser } from '@/hooks/useUserContext';
import Dashboard from '@/components/Dashboard';
import SideBar from '@/components/SideBar';

export default function DashboardPage() {
  const { isAuthenticated } = useUser();
  if (!isAuthenticated) {
    return <div>Please login to access the dashboard</div>;
  }
  return (
    <div className="flex max-h-screen bg-background w-full gap-4 p-2 sm:p-4 pb-16 md:pb-4 flex-col md:flex-row  mx-auto">
      <SideBar />
      <Dashboard />
    </div>
  );
}
