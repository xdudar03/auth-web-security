import { initTRPC } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import jwt from "jsonwebtoken";
import { getRoleByUserId, getUserById } from "../database.ts";
import { JWT_SECRET } from "../config.ts";

export const jwtSecret = JWT_SECRET;

async function createContext({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) {
  let userId = null;
  let user = null;
  let role = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token as string, jwtSecret);

      // If decoded is an object (JwtPayload), extract userId. If it's a string, ignore.
      if (
        typeof decoded === "object" &&
        decoded !== null &&
        "userId" in decoded
      ) {
        userId = typeof decoded.userId === "string" ? decoded.userId : null;
        if (userId) {
          user = getUserById(userId);
          role = getRoleByUserId(userId);
        }
      }
    } catch (error) {
      console.error("Error verifying token", error);
    }
  }
  return {
    req,
    res,
    user,
    role,
  };
}
type Context = Awaited<ReturnType<typeof createContext>>;
/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create();

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure that requires authentication.
export const protectedProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;

  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }

  return opts.next({
    ctx: {
      ...ctx,
      user: ctx.user,
      role: ctx.role,
    },
  });
});

export const adminProcedure = protectedProcedure.use(async (opts) => {
  const { ctx } = opts;
  if (!ctx.role?.canAccessAdminPanel && ctx.role?.roleName !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }

  return opts.next({ ctx });
});

export const providerProcedure = protectedProcedure.use(async (opts) => {
  const { ctx } = opts;
  const isAdmin =
    ctx.role?.canAccessAdminPanel || ctx.role?.roleName === "admin";
  const isProvider =
    ctx.role?.canAccessProviderPanel || ctx.role?.roleName === "provider";

  if (!isAdmin && !isProvider) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Provider access required",
    });
  }

  return opts.next({ ctx });
});

export { createContext };
export type { Context };
