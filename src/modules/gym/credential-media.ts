import type { AccessCredentialMedium } from "@prisma/client";

export type AccessCredentialMediumDefinition = {
  medium: AccessCredentialMedium;
  label: string;
  description: string;
  encoding: "SIGNED_APP_TOKEN" | "EXTERNAL_IDENTIFIER";
  scannerInput: "CAMERA_OR_KEYBOARD" | "KEYBOARD_OR_READER";
};

export const ACCESS_CREDENTIAL_MEDIA: readonly AccessCredentialMediumDefinition[] = [
  {
    medium: "QR_CODE",
    label: "QR code",
    description: "Carte imprimée ou affichée sur téléphone.",
    encoding: "SIGNED_APP_TOKEN",
    scannerInput: "CAMERA_OR_KEYBOARD",
  },
  {
    medium: "BARCODE",
    label: "Code-barres",
    description: "Carte lue par douchette USB ou scanner compatible.",
    encoding: "SIGNED_APP_TOKEN",
    scannerInput: "CAMERA_OR_KEYBOARD",
  },
  {
    medium: "NFC_TAG",
    label: "Badge NFC",
    description: "Identifiant d'un badge NFC lié au membre.",
    encoding: "EXTERNAL_IDENTIFIER",
    scannerInput: "KEYBOARD_OR_READER",
  },
  {
    medium: "RFID_CARD",
    label: "Carte RFID",
    description: "Identifiant d'une carte RFID lu par un terminal compatible.",
    encoding: "EXTERNAL_IDENTIFIER",
    scannerInput: "KEYBOARD_OR_READER",
  },
  {
    medium: "RFID_WRISTBAND",
    label: "Bracelet RFID",
    description: "Identifiant d'un bracelet RFID lié au même contrôle d'accès.",
    encoding: "EXTERNAL_IDENTIFIER",
    scannerInput: "KEYBOARD_OR_READER",
  },
] as const;

export function accessCredentialMediumDefinition(
  medium: AccessCredentialMedium,
): AccessCredentialMediumDefinition {
  const definition = ACCESS_CREDENTIAL_MEDIA.find((candidate) => candidate.medium === medium);
  if (!definition) throw new Error(`UNSUPPORTED_ACCESS_CREDENTIAL_MEDIUM:${medium}`);
  return definition;
}
