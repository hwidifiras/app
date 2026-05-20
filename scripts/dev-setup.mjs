import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envDevPath = path.join(root, ".env.development");
const envExamplePath = path.join(root, ".env.development.example");

if (!existsSync(envDevPath)) {
  if (!existsSync(envExamplePath)) {
    console.error("Missing .env.development.example");
    process.exit(1);
  }
  copyFileSync(envExamplePath, envDevPath);
  console.log("Created .env.development from example.");
} else {
  console.log("Using existing .env.development");
}

function readEnvValue(key) {
  const content = readFileSync(envDevPath, "utf8");
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) return undefined;
  return match[1].trim().replace(/^["']|["']$/g, "");
}

const databaseUrl = readEnvValue("DATABASE_URL") ?? "file:./prisma/dev.db";

console.log(`Applying migrations to dev database: ${databaseUrl}`);

execSync("node scripts/run-prisma-migrate.mjs", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: databaseUrl },
});

console.log("\nDev fork ready.");
console.log("  Local hot reload:  npm run dev");
console.log("  Create admin:      npm run admin:create");
console.log("  Docker sandbox:    npm run docker:dev:up  → http://localhost:3001");
