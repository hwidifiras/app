"use client";

import { Building2, ClipboardList, Dumbbell, ShieldCheck } from "lucide-react";

import {
  PERMISSION_LABELS,
  PERMISSIONS,
  type PermissionKey,
} from "@/lib/permission-definitions";
import {
  staffPresetsForProfile,
  type StaffAccessPresetId,
} from "@/lib/user-access-presets";
import { cn } from "@/lib/utils";
import type { ProductProfile } from "@/platform/product/product-context";

export type CoachAccountOption = {
  id: string;
  firstName: string;
  lastName: string;
};

export type UserAccessValue = {
  role: "ADMIN" | "STAFF";
  accessMode: "FULL" | "LIMITED";
  permissions: PermissionKey[];
  coachId: string | null;
};

const presetIcons = {
  MANAGER: Building2,
  RECEPTION_CLASS: ClipboardList,
  RECEPTION_GYM: ClipboardList,
  RECEPTION_HYBRID: ClipboardList,
  COACH: Dumbbell,
} satisfies Record<StaffAccessPresetId, typeof Building2>;

export function UserAccessFields({
  value,
  onChange,
  coaches,
  productProfile,
  allowAdmin = true,
}: {
  value: UserAccessValue;
  onChange: (value: UserAccessValue) => void;
  coaches: CoachAccountOption[];
  productProfile: ProductProfile;
  allowAdmin?: boolean;
}) {
  const staffPresets = staffPresetsForProfile(productProfile);
  const coachProfile =
    value.role === "STAFF" &&
    value.permissions.length === 1 &&
    value.permissions[0] === "class.attendance";

  function applyStaffPreset(id: StaffAccessPresetId) {
    const preset = staffPresets.find((item) => item.id === id);
    if (!preset) return;
    onChange({
      role: "STAFF",
      accessMode: id === "MANAGER" ? "FULL" : "LIMITED",
      permissions: [...preset.permissions],
      coachId: preset.requiresCoach ? value.coachId : null,
    });
  }

  function isStaffPresetSelected(id: StaffAccessPresetId) {
    if (value.role !== "STAFF") return false;
    const preset = staffPresets.find((item) => item.id === id);
    if (!preset) return false;
    return (
      preset.permissions.length === value.permissions.length &&
      preset.permissions.every((permission) => value.permissions.includes(permission)) &&
      preset.requiresCoach === Boolean(value.coachId)
    );
  }

  function togglePermission(permission: PermissionKey) {
    const permissions = value.permissions.includes(permission)
      ? value.permissions.filter((item) => item !== permission)
      : [...value.permissions, permission];
    onChange({ ...value, accessMode: "LIMITED", permissions });
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Profil de départ
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {staffPresets.map((preset) => {
            const Icon = presetIcons[preset.id];
            const selected = isStaffPresetSelected(preset.id);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyStaffPreset(preset.id)}
                className={cn(
                  "min-h-24 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  selected
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)] hover:border-[var(--primary)]/35",
                )}
                aria-pressed={selected}
              >
                <span className="flex items-center gap-2 text-sm font-black">
                  <Icon className="size-4" />
                  {preset.title}
                </span>
                <span className="mt-1.5 block text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {preset.description}
                </span>
              </button>
            );
          })}
          {allowAdmin ? (
            <button
              type="button"
              onClick={() => onChange({ role: "ADMIN", accessMode: "FULL", permissions: [], coachId: null })}
              className={cn(
                "min-h-24 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                value.role === "ADMIN"
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)] hover:border-[var(--primary)]/35",
              )}
              aria-pressed={value.role === "ADMIN"}
            >
              <span className="flex items-center gap-2 text-sm font-black">
                <ShieldCheck className="size-4" /> Admin
              </span>
              <span className="mt-1.5 block text-xs leading-relaxed text-[var(--muted-foreground)]">
                Configuration, comptes utilisateurs et journal complet.
              </span>
            </button>
          ) : null}
        </div>
      </fieldset>

      {value.role === "STAFF" ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5 text-sm font-semibold text-[var(--foreground)]">
              Niveau d&apos;accès
              <select
                value={value.accessMode}
                onChange={(event) => {
                  const accessMode = event.target.value as "FULL" | "LIMITED";
                  onChange({
                    ...value,
                    accessMode,
                    permissions: accessMode === "FULL" ? [...PERMISSIONS] : value.permissions,
                    coachId: accessMode === "FULL" ? null : value.coachId,
                  });
                }}
                className="field"
              >
                <option value="LIMITED">Droits sélectionnés</option>
                <option value="FULL">Responsable opérationnel</option>
              </select>
            </label>

            {productProfile !== "GYM_ONLY" ? (
              <label className="space-y-1.5 text-sm font-semibold text-[var(--foreground)]">
                Coach lié {coachProfile ? "*" : "(optionnel)"}
                <select
                  value={value.coachId ?? ""}
                  onChange={(event) => onChange({ ...value, coachId: event.target.value || null })}
                  className="field"
                  required={coachProfile}
                  disabled={value.accessMode === "FULL"}
                >
                  <option value="">Aucun coach</option>
                  {coaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.firstName} {coach.lastName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {value.accessMode === "LIMITED" ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {PERMISSIONS.map((permission) => (
                <label
                  key={permission}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={value.permissions.includes(permission)}
                    onChange={() => togglePermission(permission)}
                  />
                  <span>{PERMISSION_LABELS[permission]}</span>
                </label>
              ))}
            </div>
          ) : null}

          {coachProfile ? (
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
              Le compte verra uniquement les groupes, séances et élèves affectés au coach sélectionné.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
