import { z } from "zod";

export const TransactionItem = z.object({
  transactionId: z.number(),
  itemId: z.number(),
  quantity: z.number().default(1),
});

export type TransactionItem = z.infer<typeof TransactionItem>;
