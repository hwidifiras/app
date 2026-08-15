import {
  FULL_STAFF_PERMISSIONS,
  type PermissionKey,
} from "@/lib/permission-definitions";
import type { ProductProfile } from "@/platform/product/product-context";

export type StaffAccessPresetId =
  | "MANAGER"
  | "RECEPTION_CLASS"
  | "RECEPTION_GYM"
  | "RECEPTION_HYBRID"
  | "COACH";

export type StaffAccessPreset = {
  id: StaffAccessPresetId;
  title: string;
  description: string;
  permissions: PermissionKey[];
  requiresCoach: boolean;
};

export const STAFF_ACCESS_PRESETS: Record<StaffAccessPresetId, StaffAccessPreset> = {
  MANAGER: {
    id: "MANAGER",
    title: "Responsable",
    description: "Toutes les opérations du club, hors gestion des administrateurs.",
    permissions: [...FULL_STAFF_PERMISSIONS],
    requiresCoach: false,
  },
  RECEPTION_CLASS: {
    id: "RECEPTION_CLASS",
    title: "Réception cours",
    description: "Membres, inscriptions, encaissements et pointage des cours.",
    permissions: [
      "members.manage",
      "enrollment.sell",
      "payments.collect",
      "class.attendance",
      "reports.finance",
    ],
    requiresCoach: false,
  },
  RECEPTION_GYM: {
    id: "RECEPTION_GYM",
    title: "Réception salle",
    description: "Membres, ventes, encaissements et contrôle d'accès salle.",
    permissions: [
      "members.manage",
      "enrollment.sell",
      "payments.collect",
      "gym.checkin",
      "reports.finance",
    ],
    requiresCoach: false,
  },
  RECEPTION_HYBRID: {
    id: "RECEPTION_HYBRID",
    title: "Réception hybride",
    description: "Accueil commun pour cours collectifs et accès salle.",
    permissions: [
      "members.manage",
      "enrollment.sell",
      "payments.collect",
      "class.attendance",
      "gym.checkin",
      "reports.finance",
    ],
    requiresCoach: false,
  },
  COACH: {
    id: "COACH",
    title: "Coach",
    description: "Planning et pointage limités aux cours qui lui sont affectés.",
    permissions: ["class.attendance"],
    requiresCoach: true,
  },
};

export function staffPresetsForProfile(profile: ProductProfile): StaffAccessPreset[] {
  const ids: StaffAccessPresetId[] = ["MANAGER"];
  if (profile === "CLASS_ONLY") ids.push("RECEPTION_CLASS", "COACH");
  if (profile === "GYM_ONLY") ids.push("RECEPTION_GYM");
  if (profile === "HYBRID") ids.push("RECEPTION_HYBRID", "RECEPTION_CLASS", "RECEPTION_GYM", "COACH");
  return ids.map((id) => STAFF_ACCESS_PRESETS[id]);
}

export function matchingStaffPreset(permissionKeys: string[], coachId?: string | null) {
  const normalized = [...permissionKeys].sort();
  return Object.values(STAFF_ACCESS_PRESETS).find((preset) => {
    if (preset.requiresCoach !== Boolean(coachId)) return false;
    return (
      preset.permissions.length === normalized.length &&
      [...preset.permissions].sort().every((permission, index) => permission === normalized[index])
    );
  }) ?? null;
}
