export type AssociationChoice = 'hidden' | 'anonymized' | 'visible';

export type HistoryEntry = {
  id: string;
  date: string; // ISO string
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number; // in major units
  }>;
  shopLocation: string;
  paymentMethod:
    | 'Card'
    | 'Cash'
    | 'Apple Pay'
    | 'Google Pay'
    | 'Bank transfer'
    | 'Other';
  isOnline: boolean;
};
export type BackendTransactionItem = {
  name: string;
  id: number;
  quantity: number;
  price: number;
};

export type BackendTransaction = {
  transactionId: number;
  shopId: number;
  pseudoId: string | null;
  totalPrice: number;
  date: string;
  location: string | null;
  paymentMethod: string;
  purchaseType: string;
  items: BackendTransactionItem[];
};

export type TransactionsData = BackendTransaction[] | undefined;
