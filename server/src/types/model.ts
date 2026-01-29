import { z } from "zod";

export const ModelHealthResponse = z.object({
  status: z.string(),
  model_loaded: z.boolean(),
});
export type ModelHealthResponse = z.infer<typeof ModelHealthResponse>;

export const ModelStatusResponse = z.object({
  status: z.string(),
  model_name: z.string(),
  input_shape: z.array(z.number()),
  num_classes: z.number().nullable(),
});
export type ModelStatusResponse = z.infer<typeof ModelStatusResponse>;

export const PredictionResponse = z.object({
  predicted_label: z.string(),
  confidence: z.number(),
  verified: z.boolean().nullable(),
});
export type PredictionResponse = z.infer<typeof PredictionResponse>;

export const VerificationResponse = z.object({
  verified: z.boolean(),
  confidence: z.number(),
  user_id: z.string(),
});
export type VerificationResponse = z.infer<typeof VerificationResponse>;
