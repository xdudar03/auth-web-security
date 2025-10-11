'use client';
import Protected from '@/components/Protected';
import Dashboard from '@/components/Dashboard';
import SideBar from '@/components/SideBar';

export default function DashboardPage() {
  return (
    <Protected>
      <div className="flex max-h-screen bg-background w-full gap-4 p-2 sm:p-4 pb-16 md:pb-4 flex-col md:flex-row  mx-auto">
        <SideBar />
        <Dashboard />
      </div>
    </Protected>
  );
}
