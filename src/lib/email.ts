import { Resend } from "resend";

import { buildPasswordResetEmail } from "@/lib/email-templates";

export type EmailDeliveryResult =
  | { delivered: true }
  | { delivered: false; reason: "EMAIL_NOT_CONFIGURED" | "EMAIL_SEND_FAILED" };

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

/**
 * Password reset email via Resend.
 *
 * Env:
 * - RESEND_API_KEY
 * - PASSWORD_RESET_FROM — e.g. `Mon Club <onboarding@resend.dev>`
 * - APP_NAME — display name in the email (default: GymDay)
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  expiresInMinutes = 60,
): Promise<EmailDeliveryResult> {
  const from = process.env.PASSWORD_RESET_FROM?.trim();
  const resend = getResendClient();

  if (!resend || !from) {
    return { delivered: false, reason: "EMAIL_NOT_CONFIGURED" };
  }

  const { subject, html, text } = buildPasswordResetEmail({ resetUrl, expiresInMinutes });

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    console.error("Resend send failed:", { from, to, error });
    return { delivered: false, reason: "EMAIL_SEND_FAILED" };
  }

  return { delivered: true };
}
