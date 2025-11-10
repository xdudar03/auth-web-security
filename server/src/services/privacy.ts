import { HttpError } from "../errors.ts";
import {
  updateUserPrivacy,
  insertUserPrivacy,
  getUserPrivacyByUserIdAndField,
} from "../database.ts";

export default function toggleUserPrivacy(
  userId: string,
  field: string,
  visibility: "hidden" | "anonymized" | "visible"
) {
  const result = updateUserPrivacy.run(visibility, userId, field);
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
  const result = insertUserPrivacy.run(userId, field, visibility);
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
  const result = getUserPrivacyByUserIdAndField.get(userId, field);
  console.log("result: ", result);
  if (!result) {
    const insertResult = insertUserPrivacy.run(userId, field, visibility);
    console.log("insertResult: ", insertResult);
    if (insertResult.changes === 0) {
      throw new HttpError(404, "User privacy not inserted");
    }
    return { field: field, visibility: visibility };
  } else {
    const updateResult = updateUserPrivacy.run(visibility, userId, field);
    console.log("updateResult: ", updateResult);
    if (updateResult.changes === 0) {
      throw new HttpError(404, "User privacy not updated");
    }
    return { field: field, visibility: visibility };
  }
}
