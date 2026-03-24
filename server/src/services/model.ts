import { HttpError } from "../errors.ts";
import {
  ModelHealthResponse,
  ModelStatusResponse,
  PredictionResponse,
  VerificationResponse,
  AddEmbeddingResponse,
} from "../types/model.ts";
import { getUserIdByUsername } from "../database.ts";

const DEFAULT_MODEL_BASE_URL = "http://localhost:5000";
const MODEL_BASE_URL = process.env.MODEL_BASE_URL || DEFAULT_MODEL_BASE_URL;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function getModelBaseUrlCandidates(): string[] {
  const configuredBaseUrl = normalizeBaseUrl(MODEL_BASE_URL);
  const fallbackUrls: string[] = [configuredBaseUrl];

  try {
    const parsed = new URL(configuredBaseUrl);

    if (parsed.hostname === "model") {
      fallbackUrls.push(
        normalizeBaseUrl(`${parsed.protocol}//localhost:${parsed.port || "5000"}`),
      );
    }
  } catch {
    // If MODEL_BASE_URL is invalid, fetch will surface the real error.
  }

  return Array.from(new Set(fallbackUrls));
}

function isRecoverableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const cause = (error as Error & { cause?: { code?: string } }).cause;
  const code = cause?.code;
  return code === "EAI_AGAIN" || code === "ENOTFOUND" || code === "ECONNREFUSED";
}

async function fetchModel<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const candidateUrls = getModelBaseUrlCandidates();
  let lastError: unknown;

  for (const baseUrl of candidateUrls) {
    try {
      console.log("Fetching model from: ", `${baseUrl}${endpoint}`);
      const response = await fetch(`${baseUrl}${endpoint}`, {
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
      if (error instanceof HttpError) {
        throw error;
      }

      lastError = error;

      // Retry only for network-level failures on fallback hosts.
      if (!isRecoverableNetworkError(error)) {
        break;
      }
    }
  }

  try {
    throw lastError;
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
  embedding: string,
): Promise<PredictionResponse> {
  return fetchModel<PredictionResponse>("/predict", {
    method: "POST",
    body: JSON.stringify({
      embedding: JSON.parse(embedding),
    }),
  });
}

/**
 * Verify if an embedding matches a specific user.
 *
 * @param embedding - Array of numbers representing the face embedding
 * @param username - Username to verify against
 */
export async function verifyIdentity(
  embedding: string,
  username?: string,
  userId?: string,
): Promise<VerificationResponse> {
  let userToVerify: string;
  if (username) {
    userToVerify = getUserIdByUsername(username);
  } else if (userId) {
    userToVerify = userId;
  } else {
    throw new HttpError(400, "Username or userId is required");
  }
  console.log("userToVerify: ", userToVerify);

  const response = await fetchModel<VerificationResponse>("/verify", {
    method: "POST",
    body: JSON.stringify({
      embedding: JSON.parse(embedding),
      user_id: userToVerify,
    }),
  });
  console.log("response from verify: ", response);
  if (response.verified) {
    await addNewEmbedding(userToVerify, embedding);
  }
  return response;
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
