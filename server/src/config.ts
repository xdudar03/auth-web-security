import "dotenv/config";

export const port = 4000;

export const USERS_FILE_TEMP = "src/users.json";

export const SESSION_SECRET = process.env.SESSION_SECRET || "change-me";

export const CORS_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
