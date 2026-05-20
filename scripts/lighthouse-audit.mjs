/**
 * Lighthouse audits (mobile + desktop) against a running Next.js server.
 *
 * Usage:
 *   npm run build && npm run start
 *   npm run lighthouse
 *
 * Env:
 *   LIGHTHOUSE_BASE_URL  default http://127.0.0.1:3000
 *   LIGHTHOUSE_PATHS     comma-separated, default /login
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.LIGHTHOUSE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const paths = (process.env.LIGHTHOUSE_PATHS ?? "/login")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "reports", "lighthouse", stamp);

const profiles = [
  { id: "mobile", label: "Mobile", args: ["--form-factor=mobile"] },
  { id: "desktop", label: "Desktop", args: ["--preset=desktop"] },
];

async function pingServer() {
  try {
    const res = await fetch(`${baseUrl}/login`, { redirect: "manual" });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

function runLighthouse(url, profile, outfile) {
  const cli = path.join(root, "node_modules", "lighthouse", "cli", "index.js");
  const args = [
    cli,
    url,
    ...profile.args,
    "--only-categories=performance,accessibility,best-practices,seo",
    "--output=json",
    `--output-path=${outfile}`,
    "--quiet",
    "--chrome-flags=--headless --no-sandbox --disable-gpu",
  ];

  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(err || `lighthouse exited ${result.status}`);
  }

  const candidates = [outfile, `${outfile}.report.json`, `${outfile}.json`];
  const jsonPath = candidates.find((p) => fs.existsSync(p));
  if (!jsonPath) {
    throw new Error(`Missing report (tried: ${candidates.join(", ")})`);
  }
  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
}

function score(report, category) {
  const v = report?.categories?.[category]?.score;
  return v == null ? "—" : Math.round(v * 100);
}

function metricMs(report, id) {
  const v = report?.audits?.[id]?.numericValue;
  return v == null ? "—" : `${Math.round(v)} ms`;
}

console.log("GymDay Lighthouse audit\n");
console.log(`  Base URL: ${baseUrl}`);
console.log(`  Paths:    ${paths.join(", ")}`);
console.log(`  Output:   ${path.relative(root, outDir)}\n`);

if (!(await pingServer())) {
  console.error("✗ Server not reachable. Start production server first:");
  console.error("    npm run build && npm run start");
  console.error(`  Then re-run: npm run lighthouse`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const rows = [];
let failed = 0;

for (const pagePath of paths) {
  const url = `${baseUrl}${pagePath.startsWith("/") ? pagePath : `/${pagePath}`}`;
  for (const profile of profiles) {
    const slug = `${pagePath.replace(/\//g, "_").replace(/^_/, "") || "root"}-${profile.id}`;
    const outfile = path.join(outDir, `${slug}.json`);
    process.stdout.write(`▶ ${profile.label} ${pagePath} … `);

    try {
      const report = runLighthouse(url, profile, outfile);
      const row = {
        path: pagePath,
        profile: profile.label,
        performance: score(report, "performance"),
        accessibility: score(report, "accessibility"),
        bestPractices: score(report, "best-practices"),
        seo: score(report, "seo"),
        lcp: metricMs(report, "largest-contentful-paint"),
        inp: metricMs(report, "interaction-to-next-paint"),
        cls: report?.audits?.["cumulative-layout-shift"]?.displayValue ?? "—",
        file: path.relative(root, outfile),
      };
      rows.push(row);
      console.log(
        `perf ${row.performance} · a11y ${row.accessibility} · LCP ${row.lcp}`,
      );
    } catch (e) {
      failed += 1;
      console.log("FAILED");
      console.error(`  ${e.message?.split("\n")[0] ?? e}`);
    }
  }
}

const summaryPath = path.join(outDir, "summary.json");
fs.writeFileSync(summaryPath, JSON.stringify({ baseUrl, paths, rows, failed }, null, 2));

console.log("\n| Page | Profile | Perf | A11y | BP | SEO | LCP | INP | CLS |");
console.log("|------|---------|------|------|----|-----|-----|-----|-----|");
for (const r of rows) {
  console.log(
    `| ${r.path} | ${r.profile} | ${r.performance} | ${r.accessibility} | ${r.bestPractices} | ${r.seo} | ${r.lcp} | ${r.inp} | ${r.cls} |`,
  );
}

console.log(`\nSummary: ${summaryPath}`);

const thresholds = {
  performance: Number(process.env.LIGHTHOUSE_MIN_PERF ?? 0),
  accessibility: Number(process.env.LIGHTHOUSE_MIN_A11Y ?? 0),
};

if (thresholds.performance > 0 || thresholds.accessibility > 0) {
  const below = rows.filter(
    (r) =>
      (thresholds.performance > 0 && r.performance < thresholds.performance) ||
      (thresholds.accessibility > 0 && r.accessibility < thresholds.accessibility),
  );
  if (below.length > 0) {
    console.error("\n✗ Scores below thresholds:");
    for (const r of below) console.error(`  ${r.profile} ${r.path}: perf=${r.performance} a11y=${r.accessibility}`);
    process.exit(1);
  }
}

if (failed > 0) process.exit(1);
console.log("\n✓ Lighthouse audit complete.");
