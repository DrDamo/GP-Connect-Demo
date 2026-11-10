# syntax=docker/dockerfile:1
#
# GP Connect Demonstrator: one image with the built frontend and the Express
# backend (sign-in, data API, NHS terminology proxy). Built by GitHub Actions
# and pulled by the VPS; see docs/deployment-vps.md.

# --- Frontend ---------------------------------------------------------------
FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public ./public
COPY src ./src
RUN npm run build

# --- Backend ----------------------------------------------------------------
FROM node:22-alpine AS api
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build && npm prune --omit=dev

# --- Runtime ----------------------------------------------------------------
FROM node:22-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    STATIC_DIR=/app/web \
    TRUST_PROXY=1
WORKDIR /app/server
COPY --from=api /app/server/node_modules ./node_modules
COPY --from=api /app/server/dist ./dist
COPY server/package.json ./
COPY server/migrations ./migrations
COPY --from=web /app/dist /app/web

ARG GIT_COMMIT_SHA=unknown
ENV GIT_COMMIT_SHA=$GIT_COMMIT_SHA
LABEL org.opencontainers.image.source="https://github.com/DrDamo/GP-Connect-Demo" \
      org.opencontainers.image.revision=$GIT_COMMIT_SHA

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health >/dev/null || exit 1

# Migrations first; if they fail the container exits rather than serving an
# out-of-date schema.
CMD ["sh", "-c", "node dist/migrate.js && exec node dist/index.js"]
