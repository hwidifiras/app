import { Resend } from "resend";

import { buildPasswordResetEmail, buildPaymentReminderEmail } from "@/lib/email-templates";

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

export type PaymentReminderEmailParams = {
  to: string;
  memberName: string;
  totalDebtCents: number;
  lines: Array<{ label: string; outstandingCents: number }>;
  clubName: string;
  clubPhone: string;
  clubAddress: string;
};

export function isPaymentReminderEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.PASSWORD_RESET_FROM?.trim());
}

export async function sendPaymentReminderEmail(
  params: PaymentReminderEmailParams,
): Promise<EmailDeliveryResult> {
  const from = process.env.PASSWORD_RESET_FROM?.trim();
  const resend = getResendClient();

  if (!resend || !from) {
    return { delivered: false, reason: "EMAIL_NOT_CONFIGURED" };
  }

  const { subject, html, text } = buildPaymentReminderEmail({
    memberName: params.memberName,
    totalDebtCents: params.totalDebtCents,
    lines: params.lines,
    clubName: params.clubName,
    clubPhone: params.clubPhone,
    clubAddress: params.clubAddress,
  });

  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject,
    html,
    text,
  });

  if (error) {
    console.error("Resend payment reminder failed:", { from, to: params.to, error });
    return { delivered: false, reason: "EMAIL_SEND_FAILED" };
  }

  return { delivered: true };
}
