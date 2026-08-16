import { Resend } from "resend";

import { getAppName } from "@/lib/app-name";

export type SignupEmailDelivery =
  | { delivered: true }
  | { delivered: false; reason: "EMAIL_NOT_CONFIGURED" | "EMAIL_SEND_FAILED" };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
export function signupVerificationUrl(input: {
  signupId: string;
  token: string;
  platformUrl?: string;
}): string {
  const base = input.platformUrl?.trim() || process.env.PLATFORM_APP_URL?.trim();
  if (!base) throw new Error("PLATFORM_APP_URL_MISSING");
  const url = new URL("/signup/verify", base);
  url.searchParams.set("signup", input.signupId);
  url.searchParams.set("token", input.token);
  return url.toString();
}

export function buildSignupVerificationEmail(input: {
  ownerName: string;
  code: string;
  verificationUrl: string;
  expiresInMinutes?: number;
}) {
  const appNameRaw = getAppName();
  const appName = escapeHtml(appNameRaw);
  const ownerName = escapeHtml(input.ownerName);
  const url = escapeHtml(input.verificationUrl);
  const code = escapeHtml(input.code);
  const minutes = input.expiresInMinutes ?? 30;
  const subject = `${appNameRaw} - Confirmez votre adresse email`;
  const text = [
    `Bonjour ${input.ownerName},`,
    "",
    `Votre code de confirmation ${appNameRaw} est : ${input.code}`,
    `Ce code expire dans ${minutes} minutes.`,
    "",
    "Vous pouvez aussi ouvrir ce lien :",
    input.verificationUrl,
    "",
    "Si vous n'etes pas a l'origine de cette demande, ignorez cet email.",
  ].join("\n");
  const html = `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;background:#f6f9ff;font-family:Arial,sans-serif;color:#0b1220">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f6f9ff">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fff;border:1px solid #dbe4f0;border-radius:8px">
        <tr><td style="padding:28px 32px;border-bottom:1px solid #dbe4f0">
          <p style="margin:0 0 6px;color:#2563eb;font-size:12px;font-weight:700;text-transform:uppercase">Creation de votre espace</p>
          <h1 style="margin:0;font-size:22px">${appName}</h1>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6">Bonjour ${ownerName},</p>
          <p style="margin:0 0 18px;color:#52647a;font-size:15px;line-height:1.6">Confirmez votre adresse email pour continuer la configuration de votre club.</p>
          <p style="margin:0 0 22px;padding:16px;text-align:center;background:#eef4ff;border:1px solid #bfdbfe;border-radius:8px;font-size:28px;font-weight:800;letter-spacing:6px">${code}</p>
          <p style="margin:0 0 22px;text-align:center"><a href="${url}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Confirmer mon email</a></p>
          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5">Ce code expire dans ${minutes} minutes. Le lien ne peut servir qu'une fois.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject, text, html };
}

export async function sendWorkspaceVerificationEmail(input: {
  to: string;
  ownerName: string;
  code: string;
  verificationUrl: string;
}): Promise<SignupEmailDelivery> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.SAAS_SIGNUP_FROM?.trim() || process.env.PASSWORD_RESET_FROM?.trim();
  if (!apiKey || !from) return { delivered: false, reason: "EMAIL_NOT_CONFIGURED" };

  const content = buildSignupVerificationEmail(input);
  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: input.to,
    ...content,
  });
  if (error) {
    console.error("Workspace signup email failed", { to: input.to, error });
    return { delivered: false, reason: "EMAIL_SEND_FAILED" };
  }
  return { delivered: true };
}
