#!/bin/sh
# Starts FACET inside the container built by the Dockerfile: migrate, then
# run the API on loopback and the frontend on $PORT. If either one stops,
# the container stops, so the host restarts both rather than serving half.
set -e

ROOT=$(cd "$(dirname "$0")/.." && pwd)

cd "$ROOT/backend"
python -m alembic upgrade head

# An optional demo account with the five seeded portfolios. Only on the run
# that creates the account — create-user fails once it exists — so a restart
# never loads the seed twice. It has no password: sign in through Firebase
# with this address (verified) and the account is yours.
if [ -n "$FACET_DEMO_EMAIL" ]; then
  if python -m app.cli create-user --email "$FACET_DEMO_EMAIL" \
      --handle "${FACET_DEMO_HANDLE:-demo}" --name "Demo"; then
    python -m app.cli seed --email "$FACET_DEMO_EMAIL" || echo "seed failed; the account exists without it"
  else
    echo "demo account not created (it probably exists already)"
  fi
fi

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 \
  --proxy-headers --forwarded-allow-ips 127.0.0.1 &
API=$!

cd "$ROOT"
node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "${PORT:-3000}" &
WEB=$!

trap 'kill $API $WEB 2>/dev/null' TERM INT
while kill -0 "$API" 2>/dev/null && kill -0 "$WEB" 2>/dev/null; do
  sleep 2
done
kill $API $WEB 2>/dev/null || true
exit 1
