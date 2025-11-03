import {
  addUser,
  addUserToShop,
  db,
  updateUser,
  getUserById,
} from "../database.ts";
import { HttpError } from "../errors.ts";
import jwt from "jsonwebtoken";
import { jwtSecret } from "../tools/trpc.ts";
import bcrypt from "bcryptjs";

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
  embedding: unknown;
};

type ChangePasswordInput = {
  oldPassword: string;
  newPassword: string;
};

type ConfirmPasswordInput = {
  password: string;
};

export function generateJwt(userId: string) {
  return jwt.sign({ userId }, jwtSecret, { expiresIn: "1h" });
}

export async function registerBiometricUser(input: RegistrationInput) {
  console.log("registerBiometricUser input: ", input);
  const { userId, username, email, password, roleId, shopIds } = input;
  console.log("shopIds: ", shopIds.length);
  const usersFromDB = db.prepare("SELECT * FROM users").all();

  if (usersFromDB.find((query: any) => query.username === username)) {
    throw new HttpError(400, "User already exists");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  addUser.run(
    userId,
    username,
    email,
    "",
    "",
    hashedPassword,
    typeof roleId === "string" ? Number(roleId) : roleId,
    "",
    "",
    "",
    ""
  );

  const query = db
    .prepare(
      "SELECT * FROM users JOIN roles ON roles.roleId = users.roleId WHERE userId = ?"
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

  return {
    message: "Registration successful",
    jwt: generateJwt(userId),
  };
}

export async function authenticateBiometricUser(input: AuthenticationInput) {
  const { username, password } = input;

  const query = db
    .prepare(
      "SELECT * FROM users JOIN roles ON roles.roleId = users.roleId WHERE username = ? OR email = ? OR phoneNumber = ?"
    )
    .get(username, username, username);

  if (!query) {
    throw new HttpError(400, "User not found");
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    query.password as string
  );
  if (!isPasswordValid) {
    throw new HttpError(400, "Invalid password");
  }
  const jwt = generateJwt(query?.userId as string);
  console.log("jwt in authenticateBiometricUser: ", jwt);
  return { jwt };
}

export async function changeBiometricEmbedding(
  input: ChangeEmbeddingInput,
  user: any
) {
  const { embedding } = input;
  console.log("embedding: ", embedding);

  if (!user?.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const query = getUserById.get(user.userId as string);
  if (!query) {
    throw new HttpError(400, "User not found");
  }

  updateUser(query.userId as string, { embedding: embedding });

  return {
    message: "Biometric changed successfully",
  };
}

export async function changeBiometricPassword(
  input: ChangePasswordInput,
  user: any
) {
  const { oldPassword, newPassword } = input;
  console.log("user jwt: ", user);

  if (!user?.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const query = getUserById.get(user.userId as string);

  if (!query) {
    throw new HttpError(400, "User not found");
  }

  if (query.password !== oldPassword) {
    throw new HttpError(400, "Invalid password");
  }

  updateUser(query.userId as string, { password: newPassword });

  return { message: "Password changed successfully" };
}

export async function confirmBiometricPassword(
  input: ConfirmPasswordInput,
  user: any
) {
  const { password } = input;

  if (!user?.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const query = getUserById.get(user.userId as string);

  if (!query) {
    throw new HttpError(400, "User not found");
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    query.password as string
  );
  if (!isPasswordValid) {
    throw new HttpError(400, "Invalid password");
  }

  return { message: "Password confirmed successfully" };
}
