import Settings from '@/components/Settings';
import SideBar from '@/components/SideBar';
import Protected from '@/components/Protected';

export default function SettingsPage() {
  return (
    <Protected>
      <div className="sidebar-padding-left page-container">
        <SideBar />
        <Settings />
      </div>
    </Protected>
  );
}
