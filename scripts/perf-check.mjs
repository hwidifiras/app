/**
 * Full performance check: unit tests, production build, Lighthouse (mobile + desktop).
 * Requires a running server on LIGHTHOUSE_BASE_URL (starts none itself).
 *
 * Usage:
 *   Terminal A: npm run start
 *   Terminal B: npm run perf:check
 *
 * Or one-shot (starts server, runs audit, stops server):
 *   npm run perf:check:local
 */
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT ?? "3000";
const baseUrl = process.env.LIGHTHOUSE_BASE_URL ?? `http://127.0.0.1:${port}`;

function run(label, command) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, { cwd: root, shell: true, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) {
    console.error(`\n✗ Failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

const oneShot = process.argv.includes("--with-server");

async function waitForServer(ms = 60000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(`${baseUrl}/login`, { redirect: "manual" });
      if (res.ok || res.status < 500) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

console.log("GymDay performance check\n");

run("Unit & API scenarios", "npm test");
run("Production build", "npm run build");

let serverProc = null;

if (oneShot) {
  console.log("\n▶ Starting production server…");
  serverProc = spawn("npm", ["run", "start"], {
    cwd: root,
    shell: true,
    stdio: "pipe",
    env: { ...process.env, PORT: port },
  });

  const ready = await waitForServer();
  if (!ready) {
    serverProc.kill();
    console.error("✗ Server did not become ready in time");
    process.exit(1);
  }
} else {
  console.log(`\n⚠ Ensure server is running at ${baseUrl} (npm run start)`);
}

run("Lighthouse mobile + desktop", `node scripts/lighthouse-audit.mjs`);

if (serverProc) {
  serverProc.kill();
  console.log("\n▶ Server stopped");
}

console.log("\n✓ Performance check complete.");
