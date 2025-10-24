import Protected from '@/components/Protected';
import SideBar from '@/components/SideBar';
import ProviderDashboard from '@/components/provider/ProviderDashboard';

export default function ProviderDashboardPage() {
  return (
    <Protected requiredPermissions={['canAccessProviderPanel']}>
      <div className="sidebar-padding-left dashboard-grid">
        <SideBar />
        <ProviderDashboard />
      </div>
    </Protected>
  );
}
