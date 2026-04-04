'use client';
import AccountInfo from '@/components/account/AccountInfo';
import SideBar from '@/components/SideBar';
import Protected from '@/components/Protected';
import { useUser } from '@/hooks/useUserContext';
import ProviderAccount from '@/components/account/ProviderAccount';
import AdminAccountInfo from '@/components/account/AdminAccountInfo';

export default function AccountPage() {
  const { user, role } = useUser();
  console.log('user: ', user);
  return (
    <Protected>
      <div className="sidebar-padding-left page-container">
        <SideBar />
        {role?.canAccessAdminPanel ? (
          <AdminAccountInfo />
        ) : user?.roleId === 3 ? (
          <ProviderAccount />
        ) : (
          <AccountInfo />
        )}
      </div>
    </Protected>
  );
}
