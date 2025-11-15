import { z } from "zod";

export const UserTransaction = z.object({
  userId: z.string(),
  transactionId: z.number(),
  linkedAt: z.string().optional(),
});

export type UserTransaction = z.infer<typeof UserTransaction>;
