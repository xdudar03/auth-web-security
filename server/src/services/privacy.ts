import { HttpError } from "../errors.ts";
import { getUserPrivacyByUserId } from "../database.ts";
import { updateUserPrivacy } from "../database.ts";

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
