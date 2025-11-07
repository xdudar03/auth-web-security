import SideBar from '@/components/SideBar';
import Protected from '@/components/Protected';
import ShoppingHistory from '@/components/shopping-history/ShoppingHistory';

export default function ShoppingHistoryPage() {
  return (
    <Protected>
      <div className="sidebar-padding-left page-container">
        <SideBar />
        <ShoppingHistory />
      </div>
    </Protected>
  );
}
