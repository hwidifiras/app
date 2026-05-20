import { readFileSync } from "node:fs";
import { Resend } from "resend";

import { buildPasswordResetEmail } from "../src/lib/email-templates";

function loadEnvFile(path: string) {
  const text = readFileSync(path, "utf8");
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnvFile(".env.development");
process.env.APP_NAME = env.APP_NAME;
process.env.RESEND_API_KEY = env.RESEND_API_KEY;

const apiKey = env.RESEND_API_KEY?.trim();
const from = env.PASSWORD_RESET_FROM?.trim();
const to = process.argv[2]?.trim();

if (!apiKey || apiKey.includes("xxxxxxxxx")) {
  console.error("Set RESEND_API_KEY in .env.development first.");
  process.exit(1);
}

if (!from) {
  console.error("Set PASSWORD_RESET_FROM in .env.development first.");
  process.exit(1);
}

if (!to) {
  console.error("Usage: npm run email:test -- your@email.com");
  process.exit(1);
}

const resetUrl = `${env.APP_URL || "http://localhost:3000"}/reset-password?token=test-preview-token`;
const { subject, html, text } = buildPasswordResetEmail({ resetUrl, expiresInMinutes: 60 });

const resend = new Resend(apiKey);
const { data, error } = await resend.emails.send({ from, to, subject, html, text });

console.log("App name:", env.APP_NAME || "(default GymDay)");
console.log("From:", from);
console.log("To:", to);
console.log("Subject:", subject);
console.log("Result:", error ? { ok: false, error } : { ok: true, id: data?.id });
