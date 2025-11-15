import { z } from "zod";

export const Item = z.object({
  itemId: z.number(),
  itemName: z.string(),
  itemPrice: z.number(),
  shopId: z.number(),
});

export type Item = z.infer<typeof Item>;
