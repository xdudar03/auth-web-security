import z from "zod";

export const Statistic = z.object({
  userId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  shopId: z.number(),
  visitAt: z.string(),
});

export type Statistic = z.infer<typeof Statistic>;
