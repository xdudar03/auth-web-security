import { z } from "zod";

export const Pseudonym = z.object({
  pseudoId: z.string(),
  userId: z.string(),
  createdAt: z.string().optional(),
  expiresAt: z.string().nullable().optional(),
});

export type Pseudonym = z.infer<typeof Pseudonym>;
