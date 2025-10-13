'use client';
import Protected from '@/components/Protected';
import Dashboard from '@/components/dashboard/Dashboard';
import SideBar from '@/components/SideBar';

export default function DashboardPage() {
  return (
    <Protected>
      <div className=" sidebar-padding-left dashboard-grid">
        <SideBar />
        <Dashboard />
      </div>
    </Protected>
  );
}
