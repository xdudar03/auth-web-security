import { updateUser, getUserById } from "../database.ts";
import { HttpError } from "../errors.ts";
import type { User } from "../types/user.ts";
import { addNewEmbedding } from "./model.ts";

type ChangeEmbeddingInput = {
  embedding: string;
};

export async function changeBiometricEmbedding(
  input: ChangeEmbeddingInput,
  user: User,
) {
  const { embedding } = input;
  const serializedEmbedding =
    typeof embedding === "string" ? embedding : JSON.stringify(embedding);

  if (!user.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const existingUser = getUserById(user.userId);
  if (!existingUser) {
    throw new HttpError(400, "User not found");
  }

  const response = await addNewEmbedding(
    existingUser.userId,
    serializedEmbedding,
  );

  updateUser(existingUser.userId, { isBiometric: true });
  // addNewEmbedding throws on non-2xx; response message text can vary.
  if (!response?.message) {
    throw new HttpError(500, "Failed to add embedding");
  }

  return {
    message: "Biometric changed successfully",
  };
}
