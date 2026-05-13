# Client

Next.js frontend for the auth web security demo. It serves the login, MFA, passkey, biometric, admin, and customer UI.

## Setup

```bash
npm install
cp .env.example .env
```

For local development, keep `SERVER_BASE_URL` pointed at the Express server:

```bash
SERVER_BASE_URL="http://localhost:4000"
```

## Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

- `npm run build` - build the production app
- `npm run start` - run the production build
- `npm run lint` - run ESLint
- `npm run test` - run Playwright tests

For the full stack with Docker, use the root `README.md`.
