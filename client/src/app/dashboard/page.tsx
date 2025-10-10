'use client';
import { useUser } from '@/hooks/useUserContext';
import Dashboard from '@/components/Dashboard';

export default function DashboardPage() {
  const { isAuthenticated } = useUser();
  if (!isAuthenticated) {
    return <div>Please login to access the dashboard</div>;
  }
  return <Dashboard />;
}
