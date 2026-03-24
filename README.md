# auth-web-security

## Getting Started

### Prerequisites

- Node.js 18+ (for local development)
- Docker & Docker Compose (for containerized deployment)
- Python 3.12+ (for model training)

### Quick Start with Docker Compose

The easiest way to get the entire stack running is with Docker Compose.

## Deployment (Docker Compose)

Run commands from the repo root.

### Option A: Dev-style startup (fresh seed via server seed scripts)

```bash
./run-docker.sh
```

What it does:

- builds images
- starts all services (`client`, `server`, `model`)
- seeds SQLite with test/demo data for local testing
- tails logs

### Option B: Prod-style startup

```bash
./run-docker.sh prod
```

What it does:

- if `server/data/users.db` is missing, it auto-generates a seeded DB from `server/src/seed/*`
- if `server/data/users.db` exists but is empty/invalid (`user_embeddings=0`), it auto-regenerates the DB from seed scripts
- triggers initial model training from DB embeddings
- tails logs

For a clean clone from GitHub, you must seed the DB and run initial model training before using biometric recognition.
`./run-docker.sh prod` does this automatically.
The first prod run can take longer when training is required.

### Service URLs

- client: `http://localhost:3000`
- server: `http://localhost:4000`
- model: `http://localhost:5000`

### Stop / reset

Stop containers:

```bash
docker compose down
```

Stop and remove volumes (full clean reset):

```bash
docker compose down -v --remove-orphans
```

After a full reset, run either `./run-docker.sh` or `./run-docker.sh prod` again.

## Environment Variables

If you clone this repo from GitHub, create local env files from templates first:

```bash
cp server/.env.example server/.env
cp server/.env.prod.example server/.env.prod
cp client/.env.example client/.env
# optional compose overrides
cp .env.example .env
```

The root `.env` file is optional and only used for Docker Compose overrides.
App credentials/secrets still live in `server/.env` and `server/.env.prod`.

Docker startup reads:

- dev mode: `server/.env`
- prod mode: `server/.env.prod`

Required server envs:

- `SESSION_SECRET`
- `CORS_ORIGIN`
- `MODEL_BASE_URL`
- `EMAIL_USER`
- `EMAIL_PASSWORD`

### Email setup (required for working email delivery)

To make email sending work, create a new dedicated Gmail account for this app.
Do not use your personal Gmail account.

Then:

1. Enable 2-Step Verification on that Gmail account.
2. Generate an App Password in Google Account security settings.
3. Set `EMAIL_USER` to the new Gmail address.
4. Set `EMAIL_PASSWORD` to the generated App Password.

Apply the values in both `server/.env` and `server/.env.prod` if you use both modes.
For local client development, `client/.env` should point to the server (default in `client/.env.example` is `SERVER_BASE_URL="http://localhost:4000"`).

### Manual Initial Model Training (simple)

On a fresh clone, you must run DB seed + initial training at least once:

```bash
docker compose exec -T server bash -lc "/app/seedDbGit.sh"
```

This command seeds DB data and then calls the model `/initial_training` endpoint.

## Local Development (npm install)

To run the services locally on your machine:

### 1. Install Dependencies

**Client (Next.js):**

```bash
cd client
npm install
```

**Server (Express):**

```bash
cd server
npm install
```

**Model (FastAPI):**

```bash
cd model
./setup.sh
```

### 2. Set up Environment Variables

Copy the template files and fill in your values (especially email credentials):

```bash
cp server/.env.example server/.env
cp server/.env.prod.example server/.env.prod
cp client/.env.example client/.env
cp .env.example .env
```

### 3. Run the Services

**Terminal 1 - Start the Express Server:**

```bash
cd server
npm run dev
# Runs on http://localhost:4000
```

**Terminal 2 - Start the Next.js Client:**

```bash
cd client
npm run dev
# Runs on http://localhost:3000
```

**Terminal 3 - Start the FastAPI Model:**

```bash
cd model
source venv/bin/activate
uvicorn mok.api.server:app --host 0.0.0.0 --port 5000
# Runs on http://localhost:5000
```

The application will be accessible at `http://localhost:3000`.

## Notes

- The Next.js client proxies all requests from `/api/*` to the server (`SERVER_BASE_URL`).
- The server accepts CORS origins set via `CORS_ORIGIN` (comma-separated list allowed).
