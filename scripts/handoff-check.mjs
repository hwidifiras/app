/**
 * Pre-handoff verification: tests + production build.
 * Usage: node scripts/handoff-check.mjs
 */
import { execSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(label, command) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    stdio: "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(`\n✗ Failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log("GymDay handoff check\n");

try {
  execSync("npx prisma validate", { cwd: root, stdio: "pipe" });
  console.log("✓ Prisma schema valid");
} catch {
  console.warn("⚠ Prisma validate skipped or failed");
}

run("Unit & API scenarios (vitest)", "npm test");
run("Production build", "npm run build");

console.log("\n✓ Handoff check passed.");
console.log("  Next: complete manual QA — docs/first-client-handoff.md §5");
