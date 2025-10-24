import { addUser, addUserToShop, db, updateUser } from "../database.ts";
import { HttpError } from "../errors.ts";
import { mapResponseQuery } from "../utils.ts";

type RegistrationInput = {
  userId: string;
  username: string;
  email: string;
  password: string;
  roleId: number | string;
  shopIds: number[];
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
  console.log("registerBiometricUser input: ", input);
  const { userId, username, email, password, roleId, shopIds } = input;
  console.log("shopIds: ", shopIds.length);
  const usersFromDB = db.prepare("SELECT * FROM users").all();

  if (usersFromDB.find((query: any) => query.username === username)) {
    throw new HttpError(400, "User already exists");
  }

  addUser.run(
    userId,
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
      "SELECT * FROM users JOIN roles ON roles.id = users.roleId WHERE userId = ?"
    )
    .get(userId);
  console.log("query: ", query);
  if (shopIds.length > 0) {
    for (const shopId of shopIds) {
      console.log("shopId: ", shopId);
      console.log("query?.userId: ", query?.userId);
      const result = addUserToShop.run(query?.userId as string, shopId);
      console.log("result: ", result);
      if (!result) {
        throw new HttpError(400, "Failed to add user to shop");
      }
    }
  } else {
    throw new HttpError(400, "No shops provided");
  }

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

  updateUser(query.userId as string, { embedding: embedding });

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

  updateUser(query.userId as string, { password: newPassword });

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
