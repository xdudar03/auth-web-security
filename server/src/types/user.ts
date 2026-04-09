import z from "zod";
import { PrivacySettings } from "./privacySetting.ts";

export const User = z.object({
  userId: z.string(),
  hpkePublicKeyB64: z.optional(z.string().nullable()),
  recoverySaltB64: z.optional(z.string().nullable()),
  encryptedPrivateKey: z.optional(z.string().nullable()),
  encryptedPrivateKeyIv: z.optional(z.string().nullable()),
  emailHash: z.optional(z.string().nullable()),
  username: z.string(),
  password: z.string(),
  roleId: z.optional(z.number().nullable()),
  credentials: z.optional(z.string().nullable()),
  firstName: z.optional(z.string().nullable()),
  lastName: z.optional(z.string().nullable()),
  isBiometric: z
    .preprocess((value) => {
      if (value === 0) return false;
      if (value === 1) return true;
      return value;
    }, z.boolean().nullable())
    .optional()
    .default(false),
  MFAEnabled: z
    .preprocess((value) => {
      if (value === 0) return false;
      if (value === 1) return true;
      return value;
    }, z.boolean().nullable())
    .optional()
    .default(false),
  registered: z
    .preprocess((value) => {
      if (value === 0) return false;
      if (value === 1) return true;
      return value;
    }, z.boolean().nullable())
    .optional(),
  phoneNumber: z.optional(z.string().nullable()),
  dateOfBirth: z.optional(z.string().nullable()),
  gender: z.optional(z.string().nullable()),
  address: z.optional(z.string().nullable()),
  city: z.optional(z.string().nullable()),
  state: z.optional(z.string().nullable()),
  zip: z.optional(z.string().nullable()),
  country: z.optional(z.string().nullable()),
  spendings: z.optional(z.string().nullable()),
  shoppingHistory: z.optional(z.string().nullable()),
  privacy: z.optional(z.record(z.string(), PrivacySettings.shape.visibility)),
  privacyPreset: z.optional(z.string().nullable()),
});

export type User = z.infer<typeof User>;

export const UserPrivateData = z.object({
  userId: z.string(),
  original_cipher: z.optional(z.string().nullable()),
  original_iv: z.optional(z.string().nullable()),
  original_encap_pubkey: z.optional(z.string().nullable()),
  anonymized_cipher: z.optional(z.string().nullable()),
  anonymized_iv: z.optional(z.string().nullable()),
  anonymized_encap_pubkey: z.optional(z.string().nullable()),
});

export type UserPrivateData = z.infer<typeof UserPrivateData>;
