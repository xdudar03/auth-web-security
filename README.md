# auth-web-security

## Getting Started

### Prerequisites

- Node.js 18+ (for local development)
- Docker & Docker Compose (for containerized deployment)

### Quick Start with Docker Compose

The easiest way to get the entire stack running is with Docker Compose.

## Deployment (Docker Compose)

1. Create a `.env` file at the repo root using the template below:

```
SESSION_SECRET=replace-with-strong-random-secret
CORS_ORIGIN=http://localhost:3000
MODEL_BASE_URL=http://model:5000

# Client
SERVER_BASE_URL=http://server:4000

# Model (FastAPI)
EXPRESS_BASE_URL=http://server:4000
```

2. Build and start:

```
docker compose up --build -d
```

Services:

- client: http://localhost:3000
- server: http://localhost:4000

Health endpoints:

- server: GET /health

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

### 2. Set up Environment Variables

Create a `.env` file at the repo root:

```
# Server
SESSION_SECRET=replace-with-strong-random-secret
CORS_ORIGIN=http://localhost:3000
MODEL_BASE_URL=http://localhost:5000

# Client
SERVER_BASE_URL=http://localhost:4000

# Model (FastAPI)
EXPRESS_BASE_URL=http://localhost:4000
```

Additionally, create `.env.local` in the `client` directory for Next.js-specific variables:

```
NEXT_PUBLIC_SERVER_BASE_URL=http://localhost:4000
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

The application will be accessible at `http://localhost:3000`.

## Notes

- The Next.js client proxies all requests from `/api/*` to the server (`SERVER_BASE_URL`).
- The server accepts CORS origins set via `CORS_ORIGIN` (comma-separated list allowed).
