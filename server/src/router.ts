import { TRPCError } from "@trpc/server";
import { number, z } from "zod";
import { publicProcedure, router } from "./trpc.ts";
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
          id: z.string(),
          username: z.string(),
          email: z.string().email(),
          password: z.string(),
          roleId: z.union([z.string(), z.number()]),
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
      .mutation(({ input }) => execute(() => changeBiometricPassword(input))),
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
      .input(z.object({ id: z.string().optional() }))
      .query(({ input }) => execute(() => getUserWithRoleById(input.id ?? ""))),
    updateUser: publicProcedure
      .input(
        z.object({
          id: z.string(),
          updates: z.object({}).passthrough(),
        })
      )
      .mutation(({ input }) =>
        execute(() => updateUserById(input.id, input.updates as any))
      ),
  }),
});

export type AppRouter = typeof appRouter;
