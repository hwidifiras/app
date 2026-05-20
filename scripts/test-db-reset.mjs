import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(currentDir, "..");
const dbPath = join(appDir, "prisma", "test.db");
const journalPath = `${dbPath}-journal`;

for (const file of [dbPath, journalPath]) {
  if (existsSync(file)) unlinkSync(file);
}

execSync("npx prisma migrate deploy", {
  cwd: appDir,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: "file:./test.db",
  },
});
