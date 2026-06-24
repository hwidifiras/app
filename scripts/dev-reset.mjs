import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envDevPath = path.join(root, ".env.development");

function readEnvValue(key) {
  if (!existsSync(envDevPath)) return undefined;
  const content = readFileSync(envDevPath, "utf8");
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) return undefined;
  return match[1].trim().replace(/^["']|["']$/g, "");
}

const databaseUrl =
  readEnvValue("DATABASE_URL") ?? "postgresql://gymday:gymday@localhost:5432/gymday_dev?schema=public";
const env = { ...process.env, DATABASE_URL: databaseUrl, ALLOW_NON_TEST_DB_RESET: "true" };

execSync("npx prisma migrate reset --force --skip-seed", { cwd: root, stdio: "inherit", env });
execSync("npx tsx prisma/seed.ts", { cwd: root, stdio: "inherit", env });

console.log("\nClean dev database ready.");
console.log("  Login:  admin@gym.local / admin1234");
console.log("  Start:  npm run dev");
