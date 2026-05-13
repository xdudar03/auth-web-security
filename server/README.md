# Server

Express + tRPC API for the auth web security demo. It handles sessions, users, roles, MFA, passkeys, email, biometric calls, and SQLite data.

## Setup

```bash
npm install
cp .env.example .env
```

Fill in the required values in `.env`:

- `SESSION_SECRET`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `MODEL_BASE_URL`
- `EMAIL_USER`
- `EMAIL_PASSWORD`

## Run

```bash
npm run dev
```

The API runs on `http://localhost:4000`. Health check: `GET /health`.

## Useful Commands

- `npm run start` - run the server with `tsx`
- `npm run perf:sweep` - run the performance sweep script

## Data

SQLite uses `data/users.db` by default. Seed scripts live in `src/seed/`; the root Docker startup scripts can seed the DB and trigger initial model training automatically.
