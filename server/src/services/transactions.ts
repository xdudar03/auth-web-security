import {
  db,
  getTransactionsByUserId,
  getPseudonymByUserId,
  getTransactionsByShopId,
  getTransactionByTransactionId as getTransactionByTransactionIdDatabase,
  addPseudonym,
  addTransaction,
  addTransactionItem,
  linkUserTransaction,
  getItemByNameAndShop,
  getLastInsertRowId,
} from "../database.ts";
import { HttpError } from "../errors.ts";
import type { Transaction } from "../types/transaction.ts";

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
  const pseudoId = getPseudonymByUserId(userId)?.pseudoId;
  if (!pseudoId) {
    throw new HttpError(404, "Pseudo ID not found");
  }
  const transactions = getTransactionsByUserId(pseudoId);
  if (!transactions) {
    throw new HttpError(404, "Transactions not found");
  }

  const mappedTransactions = mapTransactions(transactions);
  return mappedTransactions;
};

export const getTransactionByTransactionId = async (
  transactionId: Transaction["transactionId"]
) => {
  const transaction = getTransactionByTransactionIdDatabase(transactionId);
  console.log("transaction: ", transaction);
  return transaction;
};

export const getTransactionsByShopIdService = async (shopId: number) => {
  const transactions = getTransactionsByShopId(shopId);
  console.log("transactions: ", transactions);
  if (!transactions) {
    throw new HttpError(404, "Transactions not found");
  }
  const mappedTransactions = mapTransactions(transactions);
  console.log("mappedTransactions: ", mappedTransactions);
  return mappedTransactions;
};

type LineItem = { name: string; qty: number };

function totalFor(
  shopId: number,
  items: LineItem[]
): {
  total: number;
  resolved: Array<{ itemId: number; qty: number }>;
} {
  let total = 0;
  const resolved: Array<{ itemId: number; qty: number }> = [];
  for (const { name, qty } of items) {
    const row = getItemByNameAndShop(name, shopId);
    if (!row) throw new Error(`Item not found: ${name} @ shop ${shopId}`);
    total += row.itemPrice * qty;
    resolved.push({ itemId: row.itemId, qty });
  }
  return { total, resolved };
}

export const addTestTransactionsService = async (userId: string) => {
  // Check if pseudonym already exists
  let pseudoId = getPseudonymByUserId(userId)?.pseudoId;

  if (!pseudoId) {
    // Create a new pseudonym for the user
    const timestamp = Date.now();
    pseudoId = `pseudo_${userId}_${timestamp}`;
    addPseudonym({
      pseudoId,
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: null,
    });
  }

  // Add test transactions for the user
  const testTransactions = [
    // Shop 1 transactions
    {
      shopId: 1,
      items: [
        { name: "Apple", qty: 2 },
        { name: "Bread", qty: 1 },
      ],
      location: "Store #1",
      paymentMethod: "card",
      purchaseType: "in_store",
    },
    {
      shopId: 1,
      items: [
        { name: "Apple", qty: 1 },
        { name: "Bread", qty: 2 },
      ],
      location: "Web Checkout",
      paymentMethod: "google_pay",
      purchaseType: "online",
    },
    // Shop 2 transactions
    {
      shopId: 2,
      items: [
        { name: "Pen", qty: 3 },
        { name: "Notebook", qty: 1 },
      ],
      location: "Kiosk B",
      paymentMethod: "apple_pay",
      purchaseType: "in_store",
    },
    // Shop 3 transactions
    {
      shopId: 3,
      items: [{ name: "T-Shirt", qty: 1 }],
      location: "Outlet C",
      paymentMethod: "card",
      purchaseType: "online",
    },
  ];

  for (const tx of testTransactions) {
    const { total, resolved } = totalFor(tx.shopId, tx.items);
    addTransaction({
      shopId: tx.shopId,
      pseudoId,
      totalPrice: total,
      location: tx.location,
      paymentMethod: tx.paymentMethod as any,
      purchaseType: tx.purchaseType as any,
      itemId: 0,
      quantity: 0,
      itemName: "",
      itemPrice: 0,
    });
    const id = getLastInsertRowId();
    if (!id) throw new Error("Failed to get last insert row id");
    for (const r of resolved) {
      addTransactionItem({
        transactionId: id,
        itemId: r.itemId,
        quantity: r.qty,
      });
    }
    linkUserTransaction(userId, id);
  }

  // Return the updated transactions
  return getTransactionsById(userId);
};
