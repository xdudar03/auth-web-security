import { z } from "zod";

export const Visibility = z.enum(["hidden", "anonymized", "visible"]);
export type Visibility = z.infer<typeof Visibility>;

export const PrivacySettingRecord = z.object({
  privacyId: z.number(),
  userId: z.string(),
  field: z.string(),
  visibility: Visibility,
});

export type PrivacySettingRecord = z.infer<typeof PrivacySettingRecord>;

export const PrivacySettings = z.object({
  field: z.string(),
  visibility: Visibility,
});

export type PrivacySettings = z.infer<typeof PrivacySettings>;
