FROM node:22-bookworm-slim

WORKDIR /app

# Install dependencies first (uses package-lock.json for reproducible installs)
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy application source
COPY src ./src

# Seed SQLite database file if present (compose will bind-mount to persist)
COPY users.db ./users.db

ENV NODE_ENV=production \
    MODEL_BASE_URL=http://model:5000

EXPOSE 4000

# Run TypeScript directly with tsx (installed from devDependencies)
CMD ["node", "--import", "tsx", "src/server.ts"]


