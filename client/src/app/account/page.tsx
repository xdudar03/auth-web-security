import AccountInfo from '@/components/AccountInfo';
import SideBar from '@/components/SideBar';
import Protected from '@/components/Protected';

export default function AccountPage() {
  return (
    <Protected>
      <div className="page-container">
        <SideBar />
        <AccountInfo />
      </div>
    </Protected>
  );
}
