import { initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import jwt from "jsonwebtoken";
import { getUserById } from "../database.ts";

export const jwtSecret = process.env.JWT_SECRET || "change-me";

async function createContext({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) {
  let userId = null;
  let user = null;

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
        userId = decoded.userId;
        user = getUserById(userId);
      }
    } catch (error) {
      console.error("Error verifying token", error);
    }
  }
  return {
    req,
    res,
    user,
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

// Protected procedure that requires authentication and canChangeUsersCredentials permission
export const protectedProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;

  if (!ctx.user) {
    throw new Error("Unauthorized: User not authenticated");
  }

  return opts.next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export { createContext };
export type { Context };
