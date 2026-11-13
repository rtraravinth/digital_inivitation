<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Security scan before finishing sensitive work

Before you call a feature finished, run the CodeQL security-extended scan if
the feature touches any of these:

- **auth**: sign-in, tokens, sessions, two-step, recovery codes
  (`backend/app/api/v1/auth.py`, `backend/app/services/auth.py`,
  `src/lib/api.ts`, `src/lib/session.tsx`)
- **APIs**: any route under `backend/app/api/`, or a request or response schema
- **DB queries**: services, models, raw SQL or Alembic migrations
- **file uploads**: `POST /assets`, asset serving, `src/lib/assets.ts`

Fix every **new** high or critical finding (security-severity 7.0 or more;
9.0 or more is critical) before finishing. Do not suppress one to get the scan
clean. If a finding is a false positive, say so and explain why in your report.
The current baseline has no high or critical findings. The only open alerts are
two medium `js/bad-code-sanitization` false positives in
`src/lib/theme-boot.ts`: they build the script from hard-coded constants.

The CodeQL CLI must be on `PATH`. Run these from the repo root. The output
folders are gitignored.

```
# 1. Build one database per language (Python backend, TS/JS frontend)
codeql database create codeql-dbs --db-cluster \
  --language=python,javascript-typescript --source-root=. \
  --codescanning-config=.github/codeql/codeql-config.yml \
  --build-mode=none --overwrite --threads=0

# 2. Analyze each with the security-extended suite
mkdir -p codeql-results
codeql database analyze codeql-dbs/python \
  codeql/python-queries:codeql-suites/python-security-extended.qls \
  --format=sarif-latest --output=codeql-results/python.sarif --threads=0
codeql database analyze codeql-dbs/javascript \
  codeql/javascript-queries:codeql-suites/javascript-security-extended.qls \
  --format=sarif-latest --output=codeql-results/javascript.sarif --threads=0

# 3. List high/critical findings (empty output = nothing to fix)
for f in codeql-results/*.sarif; do
  jq -r '.runs[0] as $r
    | ($r.tool.driver.rules | map({key: .id, value: (.properties["security-severity"] // "0" | tonumber)}) | from_entries) as $sev
    | $r.results[] | select($sev[.ruleId] >= 7.0)
    | "\($sev[.ruleId]) \(.ruleId) \(.locations[0].physicalLocation.artifactLocation.uri):\(.locations[0].physicalLocation.region.startLine) \(.message.text | split("\n")[0])"' "$f"
done
```

`codeql-dbs/` is rebuilt from scratch with `--overwrite`, so always re-run
step 1 after changing code. Analyzing a stale database reports old results.
After a fix, re-run all three steps and confirm the finding is gone.
