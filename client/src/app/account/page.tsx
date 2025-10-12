import AccountInfo from '@/components/account/AccountInfo';
import SideBar from '@/components/SideBar';
import Protected from '@/components/Protected';

export default function AccountPage() {
  return (
    <Protected>
      <div className="sidebar-padding-left page-container">
        <SideBar />
        <AccountInfo />
      </div>
    </Protected>
  );
}
