import { HistoryEntry } from '@/components/shopping-history/types';

export function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(iso));
}

export const formatPaymentMethod = (
  method?: string
): HistoryEntry['paymentMethod'] => {
  switch (method) {
    case 'card':
      return 'Card';
    case 'cash':
      return 'Cash';
    case 'apple_pay':
      return 'Apple Pay';
    case 'google_pay':
      return 'Google Pay';
    case 'bank_transfer':
      return 'Bank transfer';
    default:
      return 'Other';
  }
};
