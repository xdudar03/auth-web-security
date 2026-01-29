import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "./tools/trpc.ts";
import {
  getAuthenticationOptions,
  getRegistrationOptions,
  verifyAuthentication,
  verifyRegistration,
  type ChallengeSession,
} from "./services/passwordless.ts";
import {
  authenticateBiometricUser,
  changeBiometricEmbedding,
  changeBiometricPassword,
  confirmBiometricPassword,
  registerBiometricUser,
} from "./services/biometric.ts";
import {
  getUserWithRoleById,
  listUsers,
  updateUserById,
} from "./services/admin.ts";
import { checkHealth, pingHealth } from "./services/health.ts";
import {
  checkModelHealth,
  getModelStatus,
  predictFromEmbedding,
  verifyIdentity,
} from "./services/model.ts";
import { HttpError } from "./errors.ts";
import { getAllShops, getAllUsersFromShop } from "./services/shops.ts";
import {
  resetPassword,
  sendEmailWithToken,
  verifyToken,
} from "./services/email.ts";
import getUserInfo from "./services/info.ts";
import type { JwtPayload } from "jsonwebtoken";
import {
  toggleUserPrivacyService,
  getUsersPrivacy,
  getPrivacyPreset,
  getAllPrivacyPresets,
  applyPrivacyPreset,
  getUserPrivacyPreset,
} from "./services/privacy.ts";
import {
  getTransactionsById,
  getTransactionsByShopIdService,
  addTestTransactionsService,
} from "./services/transactions.ts";
import type { User } from "./types/user.ts";

function mapHttpStatusToTrpcCode(status: number): TRPCError["code"] {
  if (status >= 500) return "INTERNAL_SERVER_ERROR";
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 412:
      return "PRECONDITION_FAILED";
    case 413:
      return "PAYLOAD_TOO_LARGE";
    case 422:
      return "UNPROCESSABLE_CONTENT";
    case 429:
      return "TOO_MANY_REQUESTS";
    default:
      return "BAD_REQUEST";
  }
}

async function execute<T>(fn: () => Promise<T> | T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) {
      throw new TRPCError({
        code: mapHttpStatusToTrpcCode(error.status),
        message: error.message,
      });
    }
    throw error;
  }
}

export const appRouter = router({
  health: router({
    root: publicProcedure.query(() => pingHealth()),
    status: publicProcedure.query(() => checkHealth()),
  }),
  model: router({
    health: publicProcedure.query(() => execute(() => checkModelHealth())),
    status: publicProcedure.query(() => execute(() => getModelStatus())),
    predict: publicProcedure
      .input(
        z.object({
          embedding: z.array(z.number()),
          userId: z.string().optional(),
        }),
      )
      .mutation(({ input }) =>
        execute(() => predictFromEmbedding(input.embedding, input.userId)),
      ),
    verify: publicProcedure
      .input(
        z.object({
          embedding: z.array(z.number()),
          userId: z.string(),
        }),
      )
      .mutation(({ input }) =>
        execute(() => verifyIdentity(input.embedding, input.userId)),
      ),
  }),
  passwordless: router({
    getRegistrationOptions: publicProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(({ input, ctx }) =>
        execute(() =>
          getRegistrationOptions(
            input.userId,
            ctx.req.session as ChallengeSession,
          ),
        ),
      ),
    verifyRegistration: publicProcedure
      .input(z.any())
      .mutation(({ input, ctx }) =>
        execute(() =>
          verifyRegistration(input, ctx.req.session as ChallengeSession),
        ),
      ),
    getAuthenticationOptions: publicProcedure
      .input(z.object({ username: z.string() }))
      .mutation(({ input, ctx }) =>
        execute(() =>
          getAuthenticationOptions(
            input.username,
            ctx.req.session as ChallengeSession,
          ),
        ),
      ),
    verifyAuthentication: publicProcedure
      .input(z.any())
      .mutation(({ input, ctx }) =>
        execute(() =>
          verifyAuthentication(
            input as any,
            ctx.req.session as ChallengeSession,
          ),
        ),
      ),
  }),
  biometric: router({
    register: publicProcedure
      .input(
        z.object({
          userId: z.string(),
          username: z.string(),
          email: z.string().email(),
          password: z.string(),
          roleId: z.union([z.string(), z.number()]),
          shopIds: z.array(z.number()),
        }),
      )
      .mutation(({ input }) => execute(() => registerBiometricUser(input))),
    authenticate: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(({ input }) => execute(() => authenticateBiometricUser(input))),
    changeEmbedding: publicProcedure
      .input(
        z.object({
          embedding: z.string(), // json serialized array of numbers
        }),
      )
      .mutation(({ input, ctx }) =>
        execute(() =>
          changeBiometricEmbedding(
            { embedding: JSON.parse(input.embedding) },
            ctx.user as User,
          ),
        ),
      ),
    changePassword: publicProcedure
      .input(
        z.object({
          oldPassword: z.string(),
          newPassword: z.string(),
        }),
      )
      .mutation(({ input, ctx }) =>
        execute(() => changeBiometricPassword(input, ctx.user as User)),
      ),
    confirmPassword: publicProcedure
      .input(z.object({ password: z.string() }))
      .mutation(({ input, ctx }) =>
        execute(() => confirmBiometricPassword(input, ctx.user as User)),
      ),
  }),
  admin: router({
    listUsers: publicProcedure.query(() => execute(() => listUsers())),
    getUser: publicProcedure
      .input(z.object({ userId: z.string().optional() }))
      .query(({ input }) =>
        execute(() => getUserWithRoleById(input.userId ?? "")),
      ),
    updateUser: publicProcedure
      .input(
        z.object({
          userId: z.string(),
          updates: z.object({}).passthrough(),
        }),
      )
      .mutation(({ input }) => {
        // Admin users cannot update user information
        throw new Error(
          "Admins cannot edit user information. Use the reset password email feature instead.",
        );
      }),
  }),
  user: router({
    updateProfile: publicProcedure
      .input(
        z.object({
          userId: z.string(),
          updates: z.object({}).passthrough(),
        }),
      )
      .mutation(({ input, ctx }) => {
        // Users can only update their own profile
        const currentUserId = (ctx.user as User)?.userId;
        if (!currentUserId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Not authenticated",
          });
        }
        if (currentUserId !== input.userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Users can only update their own profile",
          });
        }
        return execute(() => updateUserById(input.userId, input.updates));
      }),
  }),
  shops: router({
    getAllShops: publicProcedure.query(() => execute(() => getAllShops())),
    getAllUsersFromShop: publicProcedure
      .input(z.object({ shopId: z.number() }))
      .query(({ input }) => execute(() => getAllUsersFromShop(input.shopId))),
  }),
  email: router({
    sendConfirmationEmail: publicProcedure
      .input(z.object({ to: z.string(), userId: z.string() }))
      .mutation(({ input }) =>
        execute(() =>
          sendEmailWithToken(input.to, input.userId, "confirmation"),
        ),
      ),
    sendResetPasswordEmail: publicProcedure
      .input(z.object({ to: z.string(), userId: z.string() }))
      .mutation(({ input }) =>
        execute(() =>
          sendEmailWithToken(input.to, input.userId, "reset_password"),
        ),
      ),
    verifyToken: publicProcedure
      .input(
        z.object({
          token: z.string(),
          purpose: z.enum(["reset_password", "confirmation"]),
        }),
      )
      .mutation(({ input }) =>
        execute(() => verifyToken(input.token, input.purpose)),
      ),
    resetPassword: publicProcedure
      .input(
        z.object({
          token: z.string(),
          newPassword: z.string(),
          userId: z.string(),
        }),
      )
      .mutation(({ input }) =>
        execute(() =>
          resetPassword(input.token, input.newPassword, input.userId),
        ),
      ),
  }),
  info: router({
    getUserInfo: publicProcedure.query(({ ctx }) =>
      execute(() => getUserInfo((ctx.user as JwtPayload) ?? {})),
    ),
  }),
  privacy: router({
    toggleUserPrivacyService: publicProcedure
      .input(
        z.object({
          field: z.string(),
          visibility: z.enum(["hidden", "anonymized", "visible"]),
        }),
      )
      .mutation(({ input, ctx }) =>
        execute(() =>
          toggleUserPrivacyService(
            ctx.user?.userId as string,
            input.field,
            input.visibility,
          ),
        ),
      ),
    getPrivacyPreset: publicProcedure
      .input(z.object({ preset: z.string() }))
      .query(({ input }) => execute(() => getPrivacyPreset(input.preset))),
    getAllPrivacyPresets: publicProcedure.query(() =>
      execute(() => getAllPrivacyPresets()),
    ),
    applyPrivacyPreset: publicProcedure
      .input(z.object({ preset: z.string() }))
      .mutation(({ input, ctx }) =>
        execute(() =>
          applyPrivacyPreset(ctx.user?.userId as string, input.preset),
        ),
      ),
    getUserPrivacyPreset: publicProcedure.query(({ ctx }) =>
      execute(() => getUserPrivacyPreset(ctx.user?.userId as string)),
    ),
    getUsersPrivacy: publicProcedure
      .input(
        z.object({
          userFields: z.array(
            z.object({ pseudoId: z.string(), field: z.string() }),
          ),
        }),
      )
      .query(({ input }) => execute(() => getUsersPrivacy(input.userFields))),
  }),
  transactions: router({
    getTransactionsById: publicProcedure
      .input(z.object({ userId: z.string() }))
      .query(({ input }) => execute(() => getTransactionsById(input.userId))),
    getTransactionsByShopId: publicProcedure
      .input(z.object({ shopId: z.number() }))
      .query(({ input }) =>
        execute(() => getTransactionsByShopIdService(input.shopId)),
      ),
    addTestTransactions: publicProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(({ input }) =>
        execute(() => addTestTransactionsService(input.userId)),
      ),
  }),
});

export type AppRouter = typeof appRouter;
