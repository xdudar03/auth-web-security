import { TRPCError } from "@trpc/server";
import { number, z } from "zod";
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
import {
  checkModelHealth,
  checkPhoto,
  deleteDataset,
  loadDataset,
} from "./services/model.ts";
import { checkHealth, pingHealth } from "./services/health.ts";
import { HttpError } from "./errors.ts";
import { getAllShops, getAllUsersFromShop } from "./services/shops.ts";
import {
  resetPassword,
  sendEmailWithToken,
  verifyToken,
} from "./services/email.ts";
import getUserInfo from "./services/info.ts";
import type { JwtPayload } from "jsonwebtoken";

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
  ping: publicProcedure
    .input(z.number())
    .query(({ input }) => `pong ${input * 2}`),
  health: router({
    root: publicProcedure.query(() => pingHealth()),
    status: publicProcedure.query(() => checkHealth()),
  }),
  passwordless: router({
    getRegistrationOptions: publicProcedure
      .input(z.object({ username: z.string() }))
      .mutation(({ input, ctx }) =>
        execute(() =>
          getRegistrationOptions(
            input.username,
            ctx.req.session as ChallengeSession
          )
        )
      ),
    verifyRegistration: publicProcedure
      .input(z.any())
      .mutation(({ input, ctx }) =>
        execute(() =>
          verifyRegistration(input, ctx.req.session as ChallengeSession)
        )
      ),
    getAuthenticationOptions: publicProcedure
      .input(z.object({ username: z.string() }))
      .mutation(({ input, ctx }) =>
        execute(() =>
          getAuthenticationOptions(
            input.username,
            ctx.req.session as ChallengeSession
          )
        )
      ),
    verifyAuthentication: publicProcedure
      .input(z.any())
      .mutation(({ input, ctx }) =>
        execute(() =>
          verifyAuthentication(
            input as any,
            ctx.req.session as ChallengeSession
          )
        )
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
        })
      )
      .mutation(({ input }) => execute(() => registerBiometricUser(input))),
    authenticate: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(({ input }) => execute(() => authenticateBiometricUser(input))),
    changeEmbedding: publicProcedure
      .input(
        z.object({
          username: z.string(),
          embedding: z.string(),
        })
      )
      .mutation(({ input }) =>
        execute(() =>
          changeBiometricEmbedding({
            username: input.username,
            embedding: input.embedding,
          })
        )
      ),
    changePassword: publicProcedure
      .input(
        z.object({
          username: z.string(),
          oldPassword: z.string(),
          newPassword: z.string(),
        })
      )
      .mutation(({ input, ctx }) =>
        execute(() => changeBiometricPassword(input, ctx.user))
      ),
    confirmPassword: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(({ input }) => execute(() => confirmBiometricPassword(input))),
  }),
  model: router({
    health: publicProcedure.query(() => execute(() => checkModelHealth())),
    checkPhoto: publicProcedure
      .input(z.object({ dataUrl: z.string() }))
      .mutation(({ input }) => execute(() => checkPhoto(input.dataUrl))),
    loadDataset: publicProcedure
      .input(z.enum(["yaleface", "lfw"]))
      .mutation(({ input }) => execute(() => loadDataset(input))),
    deleteDataset: publicProcedure.mutation(() =>
      execute(() => deleteDataset())
    ),
  }),
  admin: router({
    listUsers: publicProcedure.query(() => execute(() => listUsers())),
    getUser: publicProcedure
      .input(z.object({ userId: z.string().optional() }))
      .query(({ input }) =>
        execute(() => getUserWithRoleById(input.userId ?? ""))
      ),
    updateUser: publicProcedure
      .input(
        z.object({
          userId: z.string(),
          updates: z.object({}).passthrough(),
        })
      )
      .mutation(({ input }) =>
        execute(() => updateUserById(input.userId, input.updates as any))
      ),
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
          sendEmailWithToken(input.to, input.userId, "confirmation")
        )
      ),
    sendResetPasswordEmail: publicProcedure
      .input(z.object({ to: z.string(), userId: z.string() }))
      .mutation(({ input }) =>
        execute(() =>
          sendEmailWithToken(input.to, input.userId, "reset_password")
        )
      ),
    verifyToken: publicProcedure
      .input(
        z.object({
          token: z.string(),
          purpose: z.enum(["reset_password", "confirmation"]),
        })
      )
      .mutation(({ input }) =>
        execute(() => verifyToken(input.token, input.purpose))
      ),
    resetPassword: publicProcedure
      .input(
        z.object({
          token: z.string(),
          newPassword: z.string(),
          userId: z.string(),
        })
      )
      .mutation(({ input }) =>
        execute(() =>
          resetPassword(input.token, input.newPassword, input.userId)
        )
      ),
  }),
  info: router({
    getUserInfo: publicProcedure.query(({ ctx }) =>
      execute(() => getUserInfo((ctx.user as JwtPayload) ?? {}))
    ),
  }),
});

export type AppRouter = typeof appRouter;
