import { existsSync, readFileSync, rmSync } from "node:fs";
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

const databaseUrl = readEnvValue("DATABASE_URL") ?? "file:./prisma/dev.db";
const env = { ...process.env, DATABASE_URL: databaseUrl };

for (const file of ["prisma/dev.db", "prisma/dev.db-journal", "prisma/prod-local.db", "prisma/prod-local.db-journal"]) {
  const target = path.join(root, file);
  if (existsSync(target)) {
    rmSync(target);
    console.log(`Removed ${file}`);
  }
}

execSync("node scripts/dev-setup.mjs", { cwd: root, stdio: "inherit", env });

execSync("npx tsx prisma/seed.ts", { cwd: root, stdio: "inherit", env });

console.log("\nClean dev database ready.");
console.log("  Login:  admin@gym.local / admin1234");
console.log("  Start:  npm run dev");
