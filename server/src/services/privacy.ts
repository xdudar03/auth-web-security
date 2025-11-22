import { HttpError } from "../errors.ts";
import {
  updateUserPrivacy,
  insertUserPrivacy,
  getUserPrivacyByUserIdAndField,
  getUserIdByPseudoId,
  getUserPrivacyFieldByUserId,
} from "../database.ts";
import type { Visibility } from "../types/privacySetting.ts";
import { privacyLevelsPresets } from "../../data/presetsPL.ts";

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
