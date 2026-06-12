import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

execSync("npx prisma generate", {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
