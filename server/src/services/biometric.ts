import { addUser, db, updateUser } from "../database.ts";
import { HttpError } from "../errors.ts";
import { mapResponseQuery } from "../utils.ts";

function normalizeEmbedding(input: unknown): string | null {
  if (input == null) return null;
  if (typeof input === "string") return input;
  if (input instanceof Uint8Array || input instanceof Uint8ClampedArray) {
    return Buffer.from(input).toString("base64");
  }
  if (Array.isArray(input)) {
    return Buffer.from(Uint8Array.from(input)).toString("base64");
  }
  throw new HttpError(400, "Unsupported embedding format");
}

type RegistrationInput = {
  id: string;
  username: string;
  email: string;
  password: string;
  roleId: number | string;
};

type AuthenticationInput = {
  username: string;
  password: string;
};

type ChangeEmbeddingInput = {
  username: string;
  embedding: unknown;
};

type ChangePasswordInput = {
  username: string;
  oldPassword: string;
  newPassword: string;
};

type ConfirmPasswordInput = {
  username: string;
  password: string;
};

export async function registerBiometricUser(input: RegistrationInput) {
  const { id, username, email, password, roleId } = input;

  const usersFromDB = db.prepare("SELECT * FROM users").all();

  if (usersFromDB.find((query: any) => query.username === username)) {
    throw new HttpError(400, "User already exists");
  }

  addUser.run(
    id,
    username,
    email,
    "",
    "",
    password,
    typeof roleId === "string" ? Number(roleId) : roleId,
    "",
    "",
    "",
    ""
  );

  const query = db
    .prepare(
      "SELECT * FROM users JOIN roles ON roles.id = users.roleId WHERE username = ?"
    )
    .get(username);

  const response = mapResponseQuery(query);
  return {
    message: "Registration successful",
    user: response.user,
    role: response.role,
  };
}

export async function authenticateBiometricUser(input: AuthenticationInput) {
  const { username, password } = input;

  const query = db
    .prepare(
      "SELECT * FROM users JOIN roles ON roles.id = users.roleId WHERE username = ? OR email = ? OR phoneNumber = ?"
    )
    .get(username, username, username);

  if (!query) {
    throw new HttpError(400, "User not found");
  }

  if (query.password !== password) {
    throw new HttpError(400, "Invalid password");
  }

  const response = mapResponseQuery(query);
  return { user: response.user, role: response.role };
}

export async function changeBiometricEmbedding(input: ChangeEmbeddingInput) {
  const { username, embedding } = input;
  console.log("embedding: ", embedding);
  const usersFromDB = db.prepare("SELECT * FROM users").all();
  const query = usersFromDB.find((q: any) => q.username === username);

  if (!query) {
    throw new HttpError(400, "User not found");
  }

  updateUser(query.id as number, { embedding: embedding });

  const updated = db
    .prepare(
      "SELECT * FROM users JOIN roles ON roles.id = users.roleId WHERE username = ?"
    )
    .get(username);

  const response = mapResponseQuery(updated);

  return {
    message: "Biometric changed successfully",
    user: response.user,
    role: response.role,
  };
}

export async function changeBiometricPassword(input: ChangePasswordInput) {
  const { username, oldPassword, newPassword } = input;

  const usersFromDB = db.prepare("SELECT * FROM users").all();
  const query = usersFromDB.find((q: any) => q.username === username);

  if (!query) {
    throw new HttpError(400, "User not found");
  }

  if (query.password !== oldPassword) {
    throw new HttpError(400, "Invalid password");
  }

  updateUser(query.id as number, { password: newPassword });

  return { message: "Password changed successfully" };
}

export async function confirmBiometricPassword(input: ConfirmPasswordInput) {
  const { username, password } = input;

  const usersFromDB = db.prepare("SELECT * FROM users").all();
  const query = usersFromDB.find((q: any) => q.username === username);

  if (!query) {
    throw new HttpError(400, "User not found");
  }

  if (query.password !== password) {
    throw new HttpError(400, "Invalid password");
  }

  return { message: "Password confirmed successfully" };
}
