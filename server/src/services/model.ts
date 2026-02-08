import { HttpError } from "../errors.ts";
import {
  ModelHealthResponse,
  ModelStatusResponse,
  PredictionResponse,
  VerificationResponse,
  AddEmbeddingResponse,
} from "../types/model.ts";

const MODEL_BASE_URL = "http://localhost:5000"; // TODO: change to env variable

async function fetchModel<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  try {
    console.log("Fetching model from: ", `${MODEL_BASE_URL}${endpoint}`);
    const response = await fetch(`${MODEL_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new HttpError(
        response.status,
        errorData.detail || `Model request failed: ${response.statusText}`,
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("Model service request failed", error);
    throw new HttpError(502, "Model service unavailable");
  }
}

/**
 * Check if the model service is healthy.
 */
export async function checkModelHealth(): Promise<ModelHealthResponse> {
  return fetchModel<ModelHealthResponse>("/health");
}

/**
 * Get detailed model status.
 */
export async function getModelStatus(): Promise<ModelStatusResponse> {
  return fetchModel<ModelStatusResponse>("/status");
}

/**
 * Send embedding to model for face recognition prediction.
 *
 * @param embedding - Array of numbers representing the face embedding
 * @param userId - Optional user ID for verification mode
 */
export async function predictFromEmbedding(
  embedding: number[],
  userId?: string,
): Promise<PredictionResponse> {
  return fetchModel<PredictionResponse>("/predict", {
    method: "POST",
    body: JSON.stringify({
      embedding,
      user_id: userId,
    }),
  });
}

/**
 * Verify if an embedding matches a specific user.
 *
 * @param embedding - Array of numbers representing the face embedding
 * @param userId - User ID to verify against
 */
export async function verifyIdentity(
  embedding: number[],
  userId: string,
): Promise<VerificationResponse> {
  return fetchModel<VerificationResponse>("/verify", {
    method: "POST",
    body: JSON.stringify({
      embedding,
      user_id: userId,
    }),
  });
}

/**
 * Add a new embedding to the database and re-train the model.
 *
 * @param userId - User ID to add the embedding for
 * @param embedding - Stringified embedding to add
 */
export async function addNewEmbedding(
  userId: string,
  embedding: string,
): Promise<AddEmbeddingResponse> {
  return fetchModel<AddEmbeddingResponse>("/add_embedding", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      embedding: JSON.parse(embedding),
    }),
  });
}

export async function initialModelTraining() {
  return fetchModel<AddEmbeddingResponse>("/initial_training", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
