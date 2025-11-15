import { z } from "zod";

export const UserShop = z.object({
  userId: z.string(),
  shopId: z.number(),
});

export type UserShop = z.infer<typeof UserShop>;
