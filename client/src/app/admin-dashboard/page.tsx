import AdminDashboard from '@/components/admin/AdminDashboard';
import Protected from '@/components/Protected';
import SideBar from '@/components/SideBar';

export default function AdminDashboardPage() {
  return (
    <Protected requiredPermissions={['canAccessAdminPanel']}>
      <div className="sidebar-padding-left dashboard-grid">
        <SideBar />
        <AdminDashboard />
      </div>
    </Protected>
  );
}
