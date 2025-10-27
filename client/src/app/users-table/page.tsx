import UsersTableExtended from '@/components/UsersTableExtended';
import SideBar from '@/components/SideBar';
import Protected from '@/components/Protected';

export default function UsersTablePage() {
  return (
    <Protected requiredPermissions={['canAccessAdminPanel']}>
      <div className="sidebar-padding-left dashboard-grid">
        <SideBar />
        <UsersTableExtended />
      </div>
    </Protected>
  );
}
