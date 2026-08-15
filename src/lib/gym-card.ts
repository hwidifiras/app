import QRCode from "qrcode";

export function buildGymCredentialQrDataUrl(credentialCode: string) {
  return QRCode.toDataURL(credentialCode, {
    errorCorrectionLevel: "Q",
    margin: 2,
    scale: 7,
    type: "image/png",
  });
}
