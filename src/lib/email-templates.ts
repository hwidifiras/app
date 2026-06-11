import { getAppName } from "@/lib/app-name";

export { getAppName };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type PasswordResetEmailContent = {
  subject: string;
  html: string;
  text: string;
};

export function buildPasswordResetEmail(params: {
  resetUrl: string;
  expiresInMinutes: number;
  appName?: string;
}): PasswordResetEmailContent {
  const appName = escapeHtml(params.appName?.trim() || getAppName());
  const resetUrl = escapeHtml(params.resetUrl);
  const minutes = params.expiresInMinutes;
  const year = new Date().getFullYear();

  const subject = `${appName} — Réinitialisation de votre mot de passe`;

  const text = [
    `Bonjour,`,
    ``,
    `Vous avez demandé la réinitialisation de votre mot de passe pour ${params.appName?.trim() || getAppName()}.`,
    ``,
    `Créez un nouveau mot de passe (lien valide ${minutes} minutes) :`,
    params.resetUrl,
    ``,
    `Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
    ``,
    `— ${params.appName?.trim() || getAppName()}`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f9ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#10243f;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f6f9ff;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #d7e2f2;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(16,36,63,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1f5ea8 0%,#174a83 100%);padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.82);font-weight:600;">Réception</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25;font-weight:700;color:#ffffff;">${appName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#10243f;">Bonjour,</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#5f7390;">
                Vous avez demandé la réinitialisation du mot de passe de votre compte <strong style="color:#10243f;">${appName}</strong>.
                Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:12px;background:#1f5ea8;">
                    <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">
                      Créer un nouveau mot de passe
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#5f7390;">
                Ce lien expire dans <strong style="color:#10243f;">${minutes} minutes</strong>.
              </p>
              <p style="margin:0 0 20px;font-size:12px;line-height:1.5;color:#94a3b8;word-break:break-all;">
                Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br />
                <a href="${resetUrl}" style="color:#1f5ea8;">${resetUrl}</a>
              </p>
              <hr style="border:none;border-top:1px solid #d7e2f2;margin:24px 0;" />
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
                Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe actuel reste inchangé.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;background:#f4f8ff;text-align:center;border-top:1px solid #d7e2f2;">
              <p style="margin:0;font-size:11px;color:#5f7390;">© ${year} ${appName}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

export type PaymentReminderEmailContent = {
  subject: string;
  html: string;
  text: string;
};

export function buildPaymentReminderEmail(params: {
  memberName: string;
  totalDebtCents: number;
  lines: Array<{ label: string; outstandingCents: number }>;
  clubName: string;
  clubPhone: string;
  clubAddress: string;
  appName?: string;
}): PaymentReminderEmailContent {
  const appName = escapeHtml(params.appName?.trim() || getAppName());
  const memberName = escapeHtml(params.memberName);
  const clubName = escapeHtml(params.clubName || appName);
  const clubPhone = escapeHtml(params.clubPhone);
  const clubAddress = escapeHtml(params.clubAddress);
  const total = (params.totalDebtCents / 100).toFixed(2).replace(".", ",") + " €";
  const year = new Date().getFullYear();

  const lineText = params.lines
    .map((line) => `- ${line.label} : ${(line.outstandingCents / 100).toFixed(2).replace(".", ",")} €`)
    .join("\n");

  const lineHtml = params.lines
    .map(
      (line) =>
        `<li style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#10243f;">${escapeHtml(line.label)} — <strong>${(line.outstandingCents / 100).toFixed(2).replace(".", ",")} €</strong></li>`,
    )
    .join("");

  const subject = `${params.appName?.trim() || getAppName()} — Rappel de paiement`;

  const text = [
    `Bonjour ${params.memberName},`,
    ``,
    `Un solde de ${total} reste à régler pour votre/vos abonnement(s) :`,
    lineText,
    ``,
    `Merci de vous présenter à l'accueil ou de contacter le club pour régulariser votre situation.`,
    clubPhone ? `Téléphone : ${params.clubPhone}` : "",
    clubAddress ? `Adresse : ${params.clubAddress}` : "",
    ``,
    `— ${params.appName?.trim() || getAppName()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f9ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#10243f;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f6f9ff;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #d7e2f2;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(16,36,63,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1f5ea8 0%,#174a83 100%);padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.82);font-weight:600;">Rappel</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25;font-weight:700;color:#ffffff;">${clubName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#10243f;">Bonjour ${memberName},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5f7390;">
                Un solde de <strong style="color:#10243f;">${total}</strong> reste à régler pour votre/vos abonnement(s)&nbsp;:
              </p>
              <ul style="margin:0 0 24px;padding-left:20px;">${lineHtml}</ul>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#5f7390;">
                Merci de vous présenter à l'accueil ou de contacter le club pour régulariser votre situation.
              </p>
              ${
                clubPhone
                  ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#10243f;"><strong>Téléphone :</strong> ${clubPhone}</p>`
                  : ""
              }
              ${
                clubAddress
                  ? `<p style="margin:0;font-size:13px;line-height:1.5;color:#10243f;"><strong>Adresse :</strong> ${clubAddress}</p>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;background:#f4f8ff;text-align:center;border-top:1px solid #d7e2f2;">
              <p style="margin:0;font-size:11px;color:#5f7390;">© ${year} ${appName}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
