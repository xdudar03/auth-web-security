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
  is_training: z.boolean(),
});
export type ModelStatusResponse = z.infer<typeof ModelStatusResponse>;

export const PredictionTopKItem = z.object({
  label: z.string(),
  score: z.number(),
  ann_score: z.number().optional(),
  template_index: z.number().optional(),
});
export type PredictionTopKItem = z.infer<typeof PredictionTopKItem>;

export const PredictionResponse = z.object({
  predicted_label: z.string(),
  confidence: z.number(),
  verified: z.boolean().nullable().optional(),
  decision: z.string().optional(),
  best_score: z.number().optional(),
  second_score: z.number().optional(),
  tau_abs: z.number().optional(),
  tau_margin: z.number().optional(),
  top_k: z.array(PredictionTopKItem).optional(),
  unknown_rate: z.number().optional(),
});
export type PredictionResponse = z.infer<typeof PredictionResponse>;

export const VerificationResponse = z.object({
  verified: z.boolean(),
  confidence: z.number(),
  user_id: z.string(),
  jwt: z.string().optional(),
  hpkePublicKeyB64: z.string().nullable().optional(),
  recoverySaltB64: z.string().nullable().optional(),
  encryptedPrivateKey: z.string().nullable().optional(),
  encryptedPrivateKeyIv: z.string().nullable().optional(),
  predicted_user_id: z.string().optional(),
  predicted_user_confidence: z.number().optional(),
  verify_threshold: z.number().optional(),
  verify_accept_rate: z.number().optional(),
});
export type VerificationResponse = z.infer<typeof VerificationResponse>;

export const AddEmbeddingResponse = z.object({
  message: z.string(),
});
export type AddEmbeddingResponse = z.infer<typeof AddEmbeddingResponse>;

export const Embedding = z.object({
  userId: z.string(),
  embedding: z.string(),
  createdAt: z.string().optional(),
});
export type Embedding = z.infer<typeof Embedding>;
