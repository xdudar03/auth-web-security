import {
  db,
  getTransactionsByUserId,
  getPseudonymByUserId,
  getTransactionsByShopId,
} from "../database.ts";
import { HttpError } from "../errors.ts";

function mapTransactions(transactions: any[]) {
  // Group rows by transactionId and aggregate items
  const transactionsMap = new Map<number, any>();

  for (const row of transactions) {
    const id = row.transactionId as number;
    if (!transactionsMap.has(id)) {
      transactionsMap.set(id, {
        transactionId: id,
        shopId: row.shopId as number,
        pseudoId: row.pseudoId as string | null,
        totalPrice: row.totalPrice as number,
        date: row.date as string,
        location: (row.location as string) ?? null,
        paymentMethod: row.paymentMethod as string,
        purchaseType: row.purchaseType as string,
        items: [] as Array<{
          name: string;
          id: number;
          quantity: number;
          price: number;
        }>,
      });
    }

    const tx = transactionsMap.get(id)!;
    tx.items.push({
      name: row.itemName as string,
      id: row.itemId as number,
      quantity: row.quantity as number,
      price: row.itemPrice as number,
    });
  }
  return Array.from(transactionsMap.values());
}

export const getTransactionsById = async (userId: string) => {
  console.log("userId: ", userId);
  const pseudoId = getPseudonymByUserId.get(userId)?.pseudoId;
  console.log("pseudoId: ", pseudoId);
  if (!pseudoId) {
    throw new HttpError(404, "Pseudo ID not found");
  }
  const transactions = getTransactionsByUserId.all(pseudoId);
  if (!transactions) {
    throw new HttpError(404, "Transactions not found");
  }

  const mappedTransactions = mapTransactions(transactions);
  console.log("mappedTransactions: ", mappedTransactions);
  return mappedTransactions;
};

export const getTransactionByTransactionId = async (transactionId: string) => {
  const transaction = db
    .prepare(`SELECT * FROM transactions WHERE transactionId = ?`)
    .get(transactionId);
  console.log("transaction: ", transaction);
  return transaction;
};

export const getTransactionsByShopIdService = async (shopId: number) => {
  const transactions = getTransactionsByShopId.all(shopId);
  console.log("transactions: ", transactions);
  if (!transactions) {
    throw new HttpError(404, "Transactions not found");
  }
  const mappedTransactions = mapTransactions(transactions);
  console.log("mappedTransactions: ", mappedTransactions);
  return mappedTransactions;
};
