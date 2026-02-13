import { getAllEmbeddings } from "./src/database.ts";
import { verifyIdentity } from "./src/services/model.ts";

function toSingleEmbeddingString(rawEmbedding: string): string {
  const parsed = JSON.parse(rawEmbedding);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Embedding must be a non-empty array");
  }

  // Accept either one embedding vector ([...]) or many vectors ([[...], ...]).
  // For prediction/verification we only send one vector.
  if (Array.isArray(parsed[0])) {
    const firstVector = parsed[0];
    if (!Array.isArray(firstVector) || firstVector.length === 0) {
      throw new Error("First embedding vector must be a non-empty array");
    }
    return JSON.stringify(firstVector);
  }

  return JSON.stringify(parsed);
}

async function main(): Promise<void> {
  const allEmbeddings = getAllEmbeddings();
  const oneEmbeddingPerUser = new Map<string, string>();

  for (const userEmbedding of allEmbeddings) {
    if (oneEmbeddingPerUser.has(userEmbedding.userId)) continue;
    try {
      const singleEmbedding = toSingleEmbeddingString(userEmbedding.embedding);
      oneEmbeddingPerUser.set(userEmbedding.userId, singleEmbedding);
    } catch (error) {
      console.error(
        `Skipping user ${userEmbedding.userId}: invalid embedding payload`,
        error,
      );
    }
  }

  const results = await Promise.allSettled(
    Array.from(oneEmbeddingPerUser.entries()).map(
      async ([userId, embedding]) => {
        const response = await verifyIdentity(embedding, userId);
        return { userId, response };
      },
    ),
  );

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      console.log("response:", result.value);
    } else {
      console.error("verify failed:", result.reason);
    }
  });
}

void main();
