'use client';
import { useUser } from '@/hooks/useUserContext';
import ShoppingTable from './ShoppingTable';

export default function ShoppingHistory() {
  const { shops, user } = useUser();

  const spendings = user?.spendings
    ? JSON.parse(user?.spendings)
    : { total: 0, currency: 'USD' };

  return (
    <div className="flex flex-col gap-4 w-full bg-surface rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Shopping History</h1>
        <p className="text-sm text-muted">
          View your shopping history and manage your preferences.
        </p>
      </div>
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        {shops && shops.length > 0 ? (
          <p className="text-sm">
            You are currently shopping at:{' '}
            {shops.map((s) => s.shopName).join(', ')}
          </p>
        ) : null}
        <p className="text-sm">
          Your total spendings:{' '}
          <span className="font-bold">
            {spendings.total} {spendings.currency}
          </span>
        </p>
        <ShoppingTable />
      </div>
    </div>
  );
}
