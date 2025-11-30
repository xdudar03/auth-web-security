import { HttpError } from "../errors.ts";
import {
  updateUserPrivacy,
  insertUserPrivacy,
  getUserPrivacyByUserIdAndField,
  getUserIdByPseudoId,
  getUserPrivacyFieldByUserId,
  getUserPrivacyPresetById,
} from "../database.ts";
import type { Visibility } from "../types/privacySetting.ts";
import { privacyLevelsPresets } from "../presetsPL.ts";
import { updateUser } from "../database.ts";

export function toggleUserPrivacyService(
  userId: string,
  field: string,
  visibility: Visibility
) {
  const result = getUserPrivacyByUserIdAndField(userId, field);
  if (!result) {
    const statementChanges = insertUserPrivacy({ userId, field, visibility });
    if (statementChanges.changes === 0) {
      throw new HttpError(404, "User privacy had no changes");
    }
    return { field: field, visibility: visibility };
  } else {
    const updateResult = updateUserPrivacy({ userId, field, visibility });
    if (updateResult.changes === 0) {
      throw new HttpError(404, "User privacy had no changes");
    }
    return { field: field, visibility: visibility };
  }
}

export function getUsersPrivacy(
  userFields: { pseudoId: string; field: string }[]
) {
  const results: { pseudoId: string; field: string; visibility: string }[] = [];
  console.log("userFields: ", userFields);
  for (const { pseudoId, field } of userFields) {
    const userId = getUserIdByPseudoId(pseudoId);
    console.log("userId: ", userId);
    if (!userId) {
      throw new HttpError(404, "User not found for pseudoId: " + pseudoId);
    }
    const result = getUserPrivacyFieldByUserId(userId, field);
    console.log("result: ", result);
    if (result) {
      results.push({
        pseudoId: pseudoId,
        field: field,
        visibility: result.visibility as string,
      });
    }
  }
  console.log("results: ", results);
  return results;
}

export function getPrivacyPreset(preset: string) {
  return privacyLevelsPresets[preset]?.fields;
}

export function getAllPrivacyPresets() {
  return Object.values(privacyLevelsPresets);
}

export function applyPrivacyPreset(userId: string, preset: string) {
  const presetFields = privacyLevelsPresets[preset]?.fields;
  if (!presetFields) {
    throw new HttpError(404, "Preset not found");
  }
  const result: { field: string; visibility: Visibility }[] = [];
  for (const field in presetFields) {
    const visibility = presetFields[field] as Visibility;
    toggleUserPrivacyService(userId, field, visibility);
    result.push({ field: field, visibility: visibility });
  }
  updateUser(userId, { privacyPreset: preset });
  console.log("result: ", result);
  return result;
}

export function getUserPrivacyPreset(userId: string) {
  const privacyPreset = getUserPrivacyPresetById(userId) as string;
  console.log("privacyPreset", privacyPreset);
  if (!privacyPreset) {
    throw new HttpError(404, "Privacy preset not found");
  }
  return privacyPreset;
}
