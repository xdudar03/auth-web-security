import { z } from "zod";

export const PaymentMethod = z.enum([
  "cash",
  "card",
  "apple_pay",
  "google_pay",
  "bank_transfer",
  "other",
]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const PurchaseType = z.enum(["in_store", "online"]);
export type PurchaseType = z.infer<typeof PurchaseType>;

export const Transaction = z.object({
  transactionId: z.number(),
  shopId: z.number(),
  pseudoId: z.string().nullable().optional(),
  totalPrice: z.number(),
  date: z.string().optional(),
  location: z.string().nullable().optional(),
  paymentMethod: PaymentMethod,
  purchaseType: PurchaseType,
  itemId: z.number(),
  quantity: z.number(),
  itemName: z.string(),
  itemPrice: z.number(),
});

export type Transaction = z.infer<typeof Transaction>;
