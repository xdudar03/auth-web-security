import "dotenv/config";

export const port = 4000;

export const USERS_FILE_TEMP = "src/users.json";

const isProduction = process.env.NODE_ENV === "production";

function readSecret(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  const isPlaceholder =
    !value || value === "change-me" || value.startsWith("replace-with");

  if (isProduction && isPlaceholder) {
    throw new Error(`${name} must be set to a strong secret in production`);
  }

  return value || fallback;
}

export const SESSION_SECRET = readSecret("SESSION_SECRET", "change-me");
export const JWT_SECRET = readSecret("JWT_SECRET", "change-me");

export const CORS_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
