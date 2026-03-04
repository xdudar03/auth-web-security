import Protected from '@/components/Protected';
import SideBar from '@/components/SideBar';
import ShopStats from '@/components/provider/ShopStats';

export default function ShopStatsPage() {
  return (
    <Protected requiredPermissions={['canAccessProviderPanel']}>
      <div className="sidebar-padding-left page-container">
        <SideBar />
        <ShopStats />
      </div>
    </Protected>
  );
}
