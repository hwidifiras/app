import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("DATABASE_URL:", process.env.DATABASE_URL ?? "(not set)");

const result = spawnSync("npx prisma migrate deploy", {
  cwd: root,
  env: process.env,
  encoding: "utf8",
  shell: true,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Migrations applied.");
