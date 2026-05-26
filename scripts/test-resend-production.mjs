import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY?.trim();
const from = process.env.PASSWORD_RESET_FROM?.trim();
const appUrl = process.env.APP_URL?.trim() || "(not set)";
const to = process.argv[2]?.trim();

if (!apiKey) {
  console.error("FAIL: RESEND_API_KEY is empty inside the container.");
  console.error("Check ~/gym-saas/.env.production and restart: docker compose up -d --build");
  process.exit(1);
}

if (!from) {
  console.error("FAIL: PASSWORD_RESET_FROM is empty inside the container.");
  process.exit(1);
}

if (!to) {
  console.error("Usage: node scripts/test-resend-production.mjs your@email.com");
  process.exit(1);
}

console.log("APP_URL:", appUrl);
console.log("FROM:", from);
console.log("TO:", to);
console.log("API key prefix:", `${apiKey.slice(0, 8)}...`);

const resend = new Resend(apiKey);
const resetUrl = `${appUrl.replace(/\/$/, "")}/reset-password?token=production-email-test`;

const { data, error } = await resend.emails.send({
  from,
  to,
  subject: "GymDay — test email production",
  html: `<p>If you receive this, Resend is configured correctly.</p><p><a href="${resetUrl}">Test reset link</a></p>`,
  text: `If you receive this, Resend is configured correctly. Test link: ${resetUrl}`,
});

if (error) {
  console.error("FAIL: Resend rejected the send:");
  console.error(JSON.stringify(error, null, 2));
  process.exit(1);
}

console.log("OK: Email accepted by Resend. id:", data?.id);
console.log("Check inbox and spam for:", to);
