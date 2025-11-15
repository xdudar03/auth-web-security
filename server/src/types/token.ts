import { z } from "zod";

export const Token = z.object({
  token: z.string(),
  expiresAt: z.string(),
  purpose: z.string(),
  userId: z.string(),
});

export type Token = z.infer<typeof Token>;
