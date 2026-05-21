# Privacy-Preserving Web-Based Facial Authentication with Multi-Factor Mechanisms

## Getting Started

### Prerequisites

- Linux compatible operating system
- Node.js 18+ (for local development)
- Docker & Docker Compose (for containerized deployment)
- Python 3.12+ (for model training)

### Quick Start with Docker Compose

The easiest way to get the entire stack running is with Docker Compose.

## Environment Variables

Before running the application, you need to set up the environment variables.

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
- `JWT_SECRET`
- `CORS_ORIGIN`
- `MODEL_BASE_URL`
- `EMAIL_USER`
- `EMAIL_PASSWORD`

For production, you need to set the `SESSION_SECRET` and `JWT_SECRET` to strong random values. You can generate them with:

```bash
openssl rand -base64 32
```

For development, you can use placeholder values like `change-me` or `replace-with-strong-random-secret`.

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

## Deployment (Docker Compose)

Run commands from the repo root.

### Option A: Prod-style startup

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

### Manual Initial Model Training

If you encounter an error about the DB being empty/invalid, you can manually run the initial model training.

```bash
docker compose exec -T server bash -lc "/app/seedDbGit.sh"
```

This command seeds the DB and then calls the model `/initial_training` endpoint.

### Option B: Dev-style startup (fresh seed via server seed scripts)

```bash
./run-docker.sh
```

What it does:

- builds images
- starts all services (`client`, `server`, `model`)
- seeds SQLite with test/demo data for local testing
- tails logs

### Service URLs

- client: `http://localhost:3000`
- server: `http://localhost:4000`
- model: `http://localhost:5000`

### First Access

On the login page, use `Choose account` testing dialog to sign in with one of the seeded test accounts. For each account, the recovery passphrase is the same as the password.

| Account in dialog | Username       | Password       | Role     | Privacy setup                                                                   | Biometric data                       | Useful for                                  |
| ----------------- | -------------- | -------------- | -------- | ------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------- |
| Admin             | `admin`        | `admin`        | Admin    | `PL4` by default                                                                | No                                   | Admin dashboard and management views        |
| User              | `user`         | `user`         | User     | `PL4`, all profile fields hidden from providers                                 | No                                   | Standard user dashboard and account flow    |
| Provider 1        | `shop owner 1` | `shop owner 1` | Provider | `PL4` by default                                                                | No                                   | Provider dashboard for Shop 1               |
| Provider 2        | `shop owner 2` | `shop owner 2` | Provider | `PL4` by default                                                                | No                                   | Provider dashboard for Shop 2               |
| Provider 3        | `shop owner 3` | `shop owner 3` | Provider | `PL4` by default                                                                | No                                   | Provider dashboard for Shop 3               |
| Hidden All        | `hidden_all`   | `password1`    | User     | All privacy fields hidden                                                       | Yes, when seed embeddings are loaded | Testing fully hidden provider-visible data  |
| Anonymized All    | `anon_all`     | `password2`    | User     | All privacy fields anonymized                                                   | Yes, when seed embeddings are loaded | Testing anonymized provider-visible data    |
| Visible All       | `visible_all`  | `password3`    | User     | All privacy fields visible                                                      | Yes, when seed embeddings are loaded | Testing fully visible provider-visible data |
| Mixed A           | `mixed_a`      | `password4`    | User     | Identity fields visible, demographics anonymized, spending/history/shops hidden | Yes, when seed embeddings are loaded | Testing mixed privacy behavior              |

For biometric login, make sure the DB has been seeded with embeddings and wait about a minute after startup for the model training to finish before testing face recognition.

### Tests, Performance, and Threshold Tuning

Run these commands from the matching service folder.

**Client tests:**

```bash
cd client
npm run lint
npm run test
npm run test:ui
npm run test:report
```

- `npm run test` runs the Playwright suite in `client/tests`.
- `npm run test:ui` opens the Playwright UI runner.
- `npm run test:report` runs tests with the HTML reporter.

**Model performance tests:**

```bash
cd server
npm run perf:sweep
```

The performance sweep wraps `k6` and calls the model service on `http://localhost:5000`, so keep the model running. By default it tests both `/verify` and `/predict` using `data/sampleEmbeddings.json`, with VU levels `1,2,5,10,20,50`, and writes `report.json` plus `report.html` under `server/perf-results/<timestamp>/`.

Useful variants:

```bash
npm run perf:sweep -- --mode verify --vus 1,5,10 --thresholdMs 500
npm run perf:sweep -- --mode predict --sample data/sampleEmbeddings.json
npm run perf:sweep -- --fromDir perf-results/<run-folder>
npm run perf:sweep -- --dryRun
```

**Biometric threshold tuning:**

```bash
cd model
source venv/bin/activate
python scripts/tune_thresholds.py --output data/threshold_report.json
```

The threshold tuner is read-only: it reads `server/data/users.db`, evaluates stored biometric embeddings, prints recommended `MODEL_*` environment variables, and optionally writes a JSON report. Use `--target-far` to tune for a different false accept rate, `--prediction-mode holdout|replay|both` to change prediction evaluation, and `--json` if you want the full report printed as JSON.

### Stop / reset

Stop containers:

```bash
docker compose down
```

Stop and remove volumes (full clean reset):

```bash
docker compose down -v --remove-orphans
```

The same can be done with the following script:

```bash
./remove-volumes.sh
```

After a full reset, run either `./run-docker.sh` or `./run-docker.sh prod` again.

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
- Sometimes the db is not synced for viewing in the browser, you need to run `sqlite3 data/users.db "PRAGMA wal_checkpoint(FULL);"` in the server terminal to sync the db.
