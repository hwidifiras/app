export function buildReceiptVerificationPath(receiptNumber: string, verificationCode: string) {
  const params = new URLSearchParams({
    receiptNumber,
    code: verificationCode,
  });
  return `/receipts/verify?${params.toString()}`;
}

export function buildReceiptVerificationUrl(
  baseUrl: string,
  receiptNumber: string,
  verificationCode: string,
) {
  return new URL(buildReceiptVerificationPath(receiptNumber, verificationCode), baseUrl).toString();
}

export function buildReceiptVerificationMessage({
  receiptNumber,
  verificationCode,
  verificationUrl,
  clubName,
}: {
  receiptNumber: string;
  verificationCode: string;
  verificationUrl: string;
  clubName?: string | null;
}) {
  const prefix = clubName?.trim() ? `${clubName.trim()} - ` : "";

  return [
    `${prefix}Reçu de paiement ${receiptNumber}`,
    `Code de vérification: ${verificationCode}`,
    `Vérification publique: ${verificationUrl}`,
  ].join("\n");
}
