import { HttpError } from "../errors.ts";
import {
  updateUserPrivacy,
  insertUserPrivacy,
  getUserPrivacyByUserIdAndField,
  getUserIdByPseudoId,
  getUserPrivacyFieldByUserId,
} from "../database.ts";

export default function toggleUserPrivacy(
  userId: string,
  field: string,
  visibility: "hidden" | "anonymized" | "visible"
) {
  const result = updateUserPrivacy(visibility, userId, field);
  console.log("result: ", result);
  if (result.changes === 0) {
    throw new HttpError(404, "User privacy not updated");
  }
  return { field: field, visibility: visibility };
}

export function insertUserPrivacyService(
  userId: string,
  field: string,
  visibility: "hidden" | "anonymized" | "visible"
) {
  const result = insertUserPrivacy({ userId, field, visibility });
  console.log("result: ", result);
  if (result.changes === 0) {
    throw new HttpError(404, "User privacy not inserted");
  }
  return { field: field, visibility: visibility };
}

export function toggleUserPrivacyService(
  userId: string,
  field: string,
  visibility: "hidden" | "anonymized" | "visible"
) {
  const result = getUserPrivacyByUserIdAndField(userId, field);
  console.log("result: ", result);
  if (!result) {
    const insertResult = insertUserPrivacy({ userId, field, visibility });
    console.log("insertResult: ", insertResult);
    if (insertResult.changes === 0) {
      throw new HttpError(404, "User privacy not inserted");
    }
    return { field: field, visibility: visibility };
  } else {
    const updateResult = updateUserPrivacy(visibility, userId, field);
    console.log("updateResult: ", updateResult);
    if (updateResult.changes === 0) {
      throw new HttpError(404, "User privacy not updated");
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
