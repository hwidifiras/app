import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(currentDir, "..");
const databaseUrl =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://gymday:gymday@localhost:5432/gymday_test?schema=public";

const url = new URL(databaseUrl);
const databaseName = url.pathname.replace(/^\//, "");
const safeLocal =
  ["localhost", "127.0.0.1", "::1"].includes(url.hostname) &&
  /test/i.test(`${databaseName}${url.search}`);

if (!safeLocal && process.env.ALLOW_NON_TEST_DB_RESET !== "true") {
  console.error(
    `Refusing to reset non-test database ${url.hostname}/${databaseName}. Set ALLOW_NON_TEST_DB_RESET=true to override.`,
  );
  process.exit(1);
}

execSync("npx prisma migrate reset --force --skip-seed", {
  cwd: appDir,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
  },
});
