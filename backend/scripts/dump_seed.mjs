/**
 * Dump src/lib/seed.ts to backend/app/seed_data.json.
 *
 * The seed content is the frontend's — hand-copying it into Python would
 * start drifting the moment anyone edited a line. This transpiles the real
 * modules with the project's own TypeScript compiler and serialises what
 * they export, so re-running it is the only way the fixture ever changes.
 *
 *   node backend/scripts/dump_seed.mjs
 */

import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const require = createRequire(join(repoRoot, "package.json"));
const ts = require("typescript");

const staging = mkdtempSync(join(tmpdir(), "facet-seed-"));

for (const name of ["types", "seed"]) {
  const source = readFileSync(join(repoRoot, "src", "lib", `${name}.ts`), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  writeFileSync(join(staging, `${name}.js`), outputText);
}

const { SEED_PORTFOLIOS } = require(join(staging, "seed.js"));

const target = join(here, "..", "app", "seed_data.json");
writeFileSync(target, JSON.stringify(SEED_PORTFOLIOS, null, 2) + "\n");

console.log(`wrote ${SEED_PORTFOLIOS.length} portfolios to ${target}`);
