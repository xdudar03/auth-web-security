import express from "express";
import session from "express-session";
import cors from "cors";
import { CORS_ORIGINS, SESSION_SECRET } from "./config.ts";
import passwordlessRoutes from "./routes/passwordless.ts";
import biometricRouter from "./routes/biometric.ts";
import adminRouter from "./routes/admin.ts";
import modelRouter from "./routes/model.ts";
import healthRouter from "./routes/health.ts";
import { createContext } from "./trpc.ts";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./router.ts";

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
  })
);
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.use("/passwordless", passwordlessRoutes);
app.use("/biometric", biometricRouter);
app.use("/admin", adminRouter);
app.use("/model", modelRouter);
app.use("/", healthRouter);

export default app;
