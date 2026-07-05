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
