import {
  addProviderSharedData,
  deleteProviderSharedData,
  getProviderByProviderId,
  getProviderSharedDataByUserId,
  getUserById,
  getUserShops,
  listProviderSharedDataByUserId,
  updateProviderSharedData,
  addStatistic,
  getCustomerByCustomerId,
  getUserEmbeddingsByUserId,
} from "../database.ts";
import { HttpError } from "../errors.ts";
import { predictFromEmbedding } from "./model.ts";
import type { ProviderSharedData } from "../types/provider.ts";

type ProviderAccessVisibility = "hidden" | "anonymized" | "visible";

type SetProviderAccessInput = {
  providerId: string;
  visibility: ProviderAccessVisibility;
  providerPublicKeyHash?: string;
  userCipher?: string | null;
  userIv?: string | null;
  userEncapPubKey?: string | null;
  userVersion?: number;
};

function ensureUserCanManageProvider(userId: string, providerId: string) {
  const userShops = getUserShops(userId);
  const hasProviderRelationship = userShops.some(
    (shop) => shop.shopOwnerId === providerId,
  );

  if (!hasProviderRelationship) {
    throw new HttpError(403, "Provider is not linked to this user");
  }

  return userShops;
}

export function listProvidersForUser(userId: string) {
  const user = getUserById(userId);
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  const userShops = getUserShops(userId);
  const sharedData = listProviderSharedDataByUserId(userId);
  const providerIds = Array.from(
    new Set(
      userShops
        .map((shop) => shop.shopOwnerId)
        .filter((shopOwnerId): shopOwnerId is string => Boolean(shopOwnerId)),
    ),
  );

  const providers = providerIds
    .map((providerId) => {
      const provider = getProviderByProviderId(providerId);
      const providerUser = getUserById(providerId);
      if (!provider || !providerUser) {
        return null;
      }

      const hasVisibleAccess = sharedData.some(
        (row) => row.providerId === providerId && row.visibility === "visible",
      );
      const hasAnonymizedAccess = sharedData.some(
        (row) =>
          row.providerId === providerId && row.visibility === "anonymized",
      );

      const currentVisibility: ProviderAccessVisibility = hasVisibleAccess
        ? "visible"
        : hasAnonymizedAccess
          ? "anonymized"
          : "hidden";

      const shops = userShops
        .filter((shop) => shop.shopOwnerId === providerId)
        .map((shop) => ({
          shopId: shop.shopId,
          shopName: shop.shopName,
        }));

      return {
        providerId,
        name: provider.name ?? providerUser.username,
        hpkePublicKeyB64: providerUser.hpkePublicKeyB64 ?? null,
        currentVisibility,
        shops,
      };
    })
    .filter((provider) => provider !== null);

  return { providers };
}

export function setProviderDataAccess(
  userId: string,
  input: SetProviderAccessInput,
) {
  const user = getUserById(userId);
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  const provider = getProviderByProviderId(input.providerId);
  if (!provider) {
    throw new HttpError(404, "Provider not found");
  }

  ensureUserCanManageProvider(userId, input.providerId);

  if (input.visibility === "hidden") {
    deleteProviderSharedData(input.providerId, userId, "visible");
    deleteProviderSharedData(input.providerId, userId, "anonymized");

    return {
      providerId: input.providerId,
      visibility: "hidden" as const,
    };
  }

  if (
    !input.providerPublicKeyHash ||
    !input.userCipher ||
    !input.userIv ||
    !input.userEncapPubKey
  ) {
    throw new HttpError(
      422,
      "Missing encrypted payload for provider data sharing",
    );
  }

  const providerSharedData: ProviderSharedData = {
    providerId: input.providerId,
    userId,
    visibility: input.visibility,
    providerPublicKeyHash: input.providerPublicKeyHash,
    userCipher: input.userCipher,
    userIv: input.userIv,
    userEncapPubKey: input.userEncapPubKey,
    userVersion: input.userVersion ?? 1,
  };

  const existing = getProviderSharedDataByUserId(
    input.providerId,
    userId,
    input.visibility,
  );

  if (existing) {
    updateProviderSharedData(providerSharedData);
  } else {
    addProviderSharedData(providerSharedData);
  }

  const oppositeVisibility =
    input.visibility === "visible" ? "anonymized" : "visible";
  deleteProviderSharedData(input.providerId, userId, oppositeVisibility);

  return {
    providerId: input.providerId,
    visibility: input.visibility,
  };
}

export function getSharedUserDataForProvider(
  providerId: string,
  userId: string,
) {
  const provider = getProviderByProviderId(providerId);
  if (!provider) {
    throw new HttpError(404, "Provider not found");
  }

  const user = getUserById(userId);
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  ensureUserCanManageProvider(userId, providerId);

  const visibleData = getProviderSharedDataByUserId(
    providerId,
    userId,
    "visible",
  );
  if (visibleData) {
    return visibleData;
  }

  const anonymizedData = getProviderSharedDataByUserId(
    providerId,
    userId,
    "anonymized",
  );
  if (anonymizedData) {
    return anonymizedData;
  }

  return null;
}

export function addNewShopVisit(id: string, shopId: number, visitAt: string) {
  const user = getUserById(id);
  if (!user) {
    const customer = getCustomerByCustomerId(id);
    if (!customer) {
      throw new HttpError(404, "Customer not found");
    }
    addStatistic({
      customerId: customer.customerId,
      shopId,
      visitAt,
    });
  } else {
    addStatistic({
      userId: user.userId,
      shopId,
      visitAt,
    });
  }
}

export async function predictFromEmbeddingService(id: string) {
  const user = getUserById(id);
  if (!user) {
    const customer = getCustomerByCustomerId(id);
    if (!customer) {
      throw new HttpError(404, "Customer not found");
    }
  }
  const embeddings = getUserEmbeddingsByUserId(id);
  if (embeddings.length === 0) {
    throw new HttpError(404, "Embedding not found");
  }

  const embeddingBatch = embeddings.flatMap((embedding) => {
    if (typeof embedding !== "string") {
      return [];
    }
    const parsed = JSON.parse(embedding);
    return Array.isArray(parsed[0]) ? parsed : [parsed];
  });

  if (embeddingBatch.length === 0) {
    throw new HttpError(404, "Embedding not found");
  }

  const response = await predictFromEmbedding(JSON.stringify(embeddingBatch));
  console.log("response from predictFromEmbeddingService: ", response);
  if (!response) {
    throw new HttpError(500, "Failed to predict from embedding");
  }
  return {
    predictedLabel: response.predicted_label,
    confidence: response.confidence,
  };
}
