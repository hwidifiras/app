import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("DATABASE_URL:", process.env.DATABASE_URL ?? "(not set)");

execSync("npx prisma migrate deploy", {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

console.log("Migrations applied.");
