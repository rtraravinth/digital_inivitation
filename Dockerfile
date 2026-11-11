# FACET in one container: the Next.js frontend and the FastAPI backend behind
# a single address.
#
# One address on purpose. The refresh cookie is SameSite=Lax, so a frontend
# and an API on two different hosts would sign you out on every reload. Here
# the browser only ever talks to Next, which forwards /api/* to the API on
# loopback (see `rewrites` in next.config.ts).
#
#   docker build -t facet .
#   docker run -p 3000:3000 -e FACET_DATABASE_URL=postgresql://… -e FACET_JWT_SECRET=… -e FACET_ENV=prod facet

# ── build the frontend ────────────────────────────────────────────────────
FROM node:22-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Both are read at build time. An empty API URL makes every browser request
# relative, i.e. same-origin; the proxy target is where Next forwards them.
ENV NEXT_PUBLIC_API_URL="" \
    API_PROXY_TARGET="http://127.0.0.1:8000" \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

# ── the image that runs ───────────────────────────────────────────────────
FROM python:3.13-slim
# Node's binary needs these two; the slim Python image does not promise them.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libstdc++6 libatomic1 \
 && rm -rf /var/lib/apt/lists/*
COPY --from=web /usr/local/bin/node /usr/local/bin/node

WORKDIR /app
# Editable, so the app keeps running from /app/backend: alembic.ini, the
# migrations and seed_data.json are found beside it, as in development.
COPY backend/ backend/
RUN pip install --no-cache-dir -e ./backend

COPY --from=web /app/.next .next
COPY --from=web /app/node_modules node_modules
COPY --from=web /app/public public
COPY package.json next.config.ts ./
COPY scripts/start.sh scripts/start.sh

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    API_PROXY_TARGET="http://127.0.0.1:8000" \
    API_INTERNAL_URL="http://127.0.0.1:8000" \
    FACET_ENV=prod \
    PORT=3000
EXPOSE 3000
CMD ["sh", "scripts/start.sh"]
