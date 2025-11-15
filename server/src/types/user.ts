import z from "zod";
import { PrivacySettings } from "./privacySetting.ts";

export const User = z.object({
  userId: z.string(),
  username: z.string(),
  password: z.string(),
  embedding: z.optional(z.array(z.number()).nullable()),
  roleId: z.optional(z.number().nullable()),
  credentials: z.optional(z.unknown().nullable()),
  email: z.string(),
  firstName: z.optional(z.string().nullable()),
  lastName: z.optional(z.string().nullable()),
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
});

export type User = z.infer<typeof User>;
