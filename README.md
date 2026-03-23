# auth-web-security

## Getting Started

### Prerequisites

- Node.js 18+ (for local development)
- Docker & Docker Compose (for containerized deployment)

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

### Option B: Prod-style startup (uses prebuilt assets when available)

```bash
./run-docker.sh prod
```

What it does:

- refreshes Docker volumes from prebuilt assets when available
- if `server/data/users.db` is missing, it auto-generates a seeded DB from `server/src/seed/*`
- if `server/data/users.db` exists but is empty/invalid (`user_embeddings=0`), it auto-regenerates the DB from seed scripts
- in prod, it requires a prebuilt model and fails fast if one is not available
- it first tries `MODEL_ARTIFACT_IMAGE` (recommended for deployment), then falls back to local `model/prebuilt/trained/*`
- tails logs

For production deployments, runtime model training is disabled. Build/train artifacts ahead of time and provide them via `MODEL_ARTIFACT_IMAGE` or local `model/prebuilt/trained/*`.

`MODEL_ARTIFACT_IMAGE` contract:

- image must contain trained model files at `MODEL_ARTIFACTS_PATH` (default `/artifacts`)
- required file check: `arcface_yale_anony_v1_label_encoder.joblib`
- startup imports those files into the `model_data` Docker volume before app services start

### Build prebuilt model image in CI

Use GitHub Actions workflow `Build Model Artifact Image` to train and publish model artifacts to GHCR.

What it does:

- starts `server` + `model` in Docker Compose
- runs `/app/seedDbGit.sh` (seeds DB and requests initial model training)
- waits until trained model artifacts exist
- packages trained files into image: `ghcr.io/<owner>/auth-model-artifacts:<tag>`
- pushes the image to GHCR

How to trigger:

- GitHub -> Actions -> `Build Model Artifact Image` -> `Run workflow`
- optional input: `image_tag` (if omitted, commit SHA is used)

Then deploy with:

```bash
MODEL_ARTIFACT_IMAGE=ghcr.io/<owner>/auth-model-artifacts:<tag> ./run-docker.sh prod
```

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

Prod-only model artifact envs (set in root `.env` or deployment env):

- `MODEL_ARTIFACT_IMAGE` (recommended): container image that contains prebuilt model files
- `MODEL_ARTIFACTS_PATH` path inside artifact image (default: `/artifacts`)

Docker startup reads:

- dev mode: `server/.env`
- prod mode: `server/.env.prod`

In prod mode, startup also validates that a prebuilt model exists:

- preferred: `MODEL_ARTIFACT_IMAGE` + `MODEL_ARTIFACTS_PATH`
- fallback: local `model/prebuilt/trained/*`
- if neither exists, startup exits with an error

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
uvicorn mok.api.server:app --host 0.0.0.0 --port 5000
# Runs on http://localhost:5000
```

The application will be accessible at `http://localhost:3000`.

## Notes

- The Next.js client proxies all requests from `/api/*` to the server (`SERVER_BASE_URL`).
- The server accepts CORS origins set via `CORS_ORIGIN` (comma-separated list allowed).
