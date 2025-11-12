'use client';
import { useUser } from '@/hooks/useUserContext';
import ShopOrdersTable from './ShopOrdersTable';
export default function ShopHistory() {
  const { shops } = useUser();
  const shopName = shops?.[0]?.shopName;
  const shopId = shops?.[0]?.shopId;

  return (
    <div className="flex flex-col gap-4 w-full bg-surface rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Shop History</h1>
        <p className="text-sm text-muted">
          View order history for your shop{' '}
          <span className="font-bold">{shopName}</span>.
        </p>
      </div>
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <ShopOrdersTable shopId={shopId as number} />
      </div>
    </div>
  );
}
