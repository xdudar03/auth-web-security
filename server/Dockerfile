FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first (uses package-lock.json for reproducible installs)
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy application source
COPY src ./src
COPY config ./config
COPY yalefaces ./yalefaces
COPY seedDb.sh ./seedDb.sh
COPY seedDbGit.sh ./seedDbGit.sh
RUN chmod +x ./seedDb.sh ./seedDbGit.sh

ENV NODE_ENV=production \
    MODEL_BASE_URL=http://model:5000

EXPOSE 4000

# Run TypeScript directly with tsx (installed from devDependencies)
CMD ["npm", "run", "start"]


