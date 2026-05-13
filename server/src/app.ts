import express from "express";
import session from "express-session";
import cors from "cors";
import { CORS_ORIGINS, SESSION_SECRET } from "./config.ts";
import { createContext } from "./tools/trpc.ts";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./router.ts";
import { createSessionStore } from "./sessionStore.ts";

export type { AppRouter } from "./router.ts";

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(
  session({
    store: createSessionStore(),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  }),
);

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

export default app;
