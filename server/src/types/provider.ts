import { z } from "zod";

export const Provider = z.object({
  providerId: z.string(),
  name: z.optional(z.string().nullable()),
  createdAt: z.optional(z.string().nullable()),
});

export type Provider = z.infer<typeof Provider>;

export const ProviderSharedData = z.object({
  providerId: z.string(),
  userId: z.string(),
  visibility: z.enum(["anonymized", "visible"]),
  providerPublicKeyHash: z.string(),
  userCipher: z.string().nullable(),
  userIv: z.string().nullable(),
  userEncapPubKey: z.string().nullable(),
  userVersion: z.optional(z.number()),
});

export type ProviderSharedData = z.infer<typeof ProviderSharedData>;
