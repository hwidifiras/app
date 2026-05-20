import { execSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CLUB_LOGO_MIGRATION = "20260520140000_club_logo_url";

console.log("DATABASE_URL:", process.env.DATABASE_URL ?? "(not set)");

function runMigrateDeploy() {
  return spawnSync("npx prisma migrate deploy", {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: true,
  });
}

function markClubLogoMigrationApplied() {
  console.log("Column clubLogoUrl already exists — marking migration as applied...");
  execSync(`npx prisma migrate resolve --applied ${CLUB_LOGO_MIGRATION}`, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
}

function isDuplicateClubLogoColumnError(output) {
  return (
    output.includes("duplicate column name: clubLogoUrl") ||
    (output.includes(CLUB_LOGO_MIGRATION) && output.includes("clubLogoUrl"))
  );
}

let result = runMigrateDeploy();

if (result.status !== 0) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (isDuplicateClubLogoColumnError(output)) {
    markClubLogoMigrationApplied();
    result = runMigrateDeploy();
  }
}

if (result.status !== 0) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

if (result.stdout) process.stdout.write(result.stdout);
console.log("Migrations applied.");
