'use client';
import { useUser } from '@/hooks/useUserContext';

export default function DashboardPage() {
  const { isAuthenticated } = useUser();
  if (!isAuthenticated) {
    return <div>Please login to access the dashboard</div>;
  }
  return <div>Dashboard</div>;
}
