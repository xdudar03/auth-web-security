import { getAllEmbeddings } from "./src/database.ts";
import { verifyIdentity } from "./src/services/model.ts";

async function main(): Promise<void> {
  const allEmbeddings = getAllEmbeddings();
  const embeddingPerUser = new Map<string, string[]>();

  for (const userEmbedding of allEmbeddings) {
    if (embeddingPerUser.has(userEmbedding.userId)) continue;
    try {
      const parsed = JSON.parse(userEmbedding.embedding);
      const embeddingBatch = Array.isArray(parsed[0]) ? parsed : [parsed];
      embeddingPerUser.set(userEmbedding.userId, embeddingBatch);
    } catch (error) {
      console.error(
        `Skipping user ${userEmbedding.userId}: invalid embedding payload`,
        error,
      );
    }
  }
  console.log("embeddingPerUser user ids", Array.from(embeddingPerUser.keys()));
  const results = await Promise.allSettled(
    Array.from(embeddingPerUser.entries()).map(async ([userId, embedding]) => {
      const response = await verifyIdentity(
        JSON.stringify(embedding),
        undefined,
        userId,
      );
      return { userId, response };
    }),
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
