import { z } from "zod";

export const Shop = z.object({
  shopId: z.number(),
  shopName: z.string(),
  shopAddress: z.string(),
  shopDescription: z.string(),
  shopOwnerId: z.string(),
});

export type Shop = z.infer<typeof Shop>;
