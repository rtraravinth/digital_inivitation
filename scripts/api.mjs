// Starts the FACET API the way the frontend expects to reach it.
//
// Two things kept going wrong when this was a command people typed: the venv
// lives at .venv/bin on Linux and macOS but .venv/Scripts on Windows, and
// uvicorn's default bind is loopback, which silently breaks the app whenever
// NEXT_PUBLIC_API_URL points at a LAN address (a phone on the same Wi-Fi).
// Binding every interface is the default here, so the two cannot disagree.
//
//   npm run api                     → 0.0.0.0:8000
//   npm run api -- --host 127.0.0.1 → loopback only
//   npm run api -- --port 8001      → another port

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");

const candidates = [
  path.join(backend, ".venv", "bin", "python"),
  path.join(backend, ".venv", "Scripts", "python.exe"),
  path.join(backend, ".venv", "Scripts", "python"),
];
const python = candidates.find((p) => existsSync(p));

if (!python) {
  console.error(
    `No virtualenv found under ${path.join(backend, ".venv")}.\n` +
      "Create it first — see backend/README.md.",
  );
  process.exit(1);
}

// Anything after `--` wins, so a flag passed on the command line overrides
// the default rather than being sent twice.
const passed = process.argv.slice(2);
const defaults = [];
if (!passed.includes("--host")) defaults.push("--host", "0.0.0.0");
if (!passed.includes("--port")) defaults.push("--port", "8000");

const child = spawn(
  python,
  ["-m", "uvicorn", "app.main:app", "--reload", ...defaults, ...passed],
  { cwd: backend, stdio: "inherit" },
);

child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
