#!/usr/bin/env bash
# Lint the SQL of every Alembic migration added since a base ref with squawk.
#
#   backend/scripts/squawk_new_migrations.sh origin/main
#
# Run from backend/. Each new migration is rendered offline, on its own
# revision range, so squawk sees exactly the statements it adds. A migration
# that reads rows (bind.execute(...).fetchall()) cannot be rendered offline;
# it gets a warning to review by hand instead of a lint.
set -euo pipefail

base="${1:?usage: $0 <base-ref>}"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT

mapfile -t added < <(
  git diff --name-only --diff-filter=A "$base"...HEAD -- 'alembic/versions/*.py' |
    sed 's#^backend/##'
)

if [ "${#added[@]}" -eq 0 ]; then
  echo "No new migrations."
  exit 0
fi

status=0
for file in "${added[@]}"; do
  rev="$(sed -nE 's/^revision[^=]*= *"([0-9a-f]+)".*/\1/p' "$file")"
  down="$(sed -nE 's/^down_revision[^=]*= *"([0-9a-f]+)".*/\1/p' "$file")"
  range="${down:+$down:}$rev"
  sql="$out/$rev.sql"

  if ! alembic upgrade "$range" --sql >"$sql" 2>"$out/$rev.err"; then
    echo "::warning file=backend/$file::Could not render $rev offline (a data migration?). Review its locking by hand."
    continue
  fi
  echo "── $file ($range)"
  squawk "$sql" || status=1
done

exit "$status"
