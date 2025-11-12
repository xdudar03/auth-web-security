import Protected from '@/components/Protected';
import SideBar from '@/components/SideBar';
import ShopHistory from '@/components/provider/ShopHistory';

export default function ShopHistoryPage() {
  return (
    <Protected requiredPermissions={['canAccessProviderPanel']}>
      <div className="sidebar-padding-left page-container">
        <SideBar />
        <ShopHistory />
      </div>
    </Protected>
  );
}
