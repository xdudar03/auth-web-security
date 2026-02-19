import z from "zod";

export const Customer = z.object({
  customerId: z.string(),
  isBiometric: z.preprocess((value) => {
    if (value === 0) return false;
    if (value === 1) return true;
    return value;
  }, z.boolean()),
});

export type Customer = z.infer<typeof Customer>;
