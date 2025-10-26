import { initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import jwt from "jsonwebtoken";

export const jwtSecret = process.env.JWT_SECRET || "change-me";

async function createContext({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) {
  let user = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    console.log("token in trpc context server: ", token);
    try {
      const decoded = jwt.verify(token as string, jwtSecret);
      console.log("decoded: ", decoded);
      user = decoded;
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
export { createContext };
export type { Context };
