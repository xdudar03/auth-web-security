import SideBar from '@/components/SideBar';
import Protected from '@/components/Protected';
import UsersActivity from '@/components/admin/UsersActivity';

export default function UsersActivityPage() {
  return (
    <Protected>
      <div className="sidebar-padding-left page-container">
        <SideBar />
        <UsersActivity />
      </div>
    </Protected>
  );
}
