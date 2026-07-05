import QRCode from "qrcode";

export async function buildReceiptVerificationQrDataUrl(verificationUrl: string | undefined) {
  if (!verificationUrl) return undefined;

  return QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 5,
    type: "image/png",
  });
}
