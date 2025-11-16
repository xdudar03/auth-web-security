FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY client/package*.json ./
COPY client/eslint.config.mjs ./
RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY client/ .
COPY server/ ../server/
ENV NEXT_DISABLE_ESLINT=true \
    SERVER_BASE_URL=http://server:4000
RUN npm run build -- --no-lint

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    SERVER_BASE_URL=http://server:4000

# Only copy necessary files for runtime
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["npm", "run", "start"]


