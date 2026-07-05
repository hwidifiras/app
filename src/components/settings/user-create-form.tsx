"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Dumbbell, ShieldCheck } from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";
import { PERMISSION_LABELS, PERMISSIONS, type PermissionKey } from "@/lib/permission-definitions";
import { cn } from "@/lib/utils";

const RECEPTION_PERMISSIONS: PermissionKey[] = [
  "members.manage",
  "enrollment.manage",
  "attendance.manage",
  "payments.manage",
];

const COACH_PERMISSIONS: PermissionKey[] = ["attendance.manage"];

const ROLE_PRESETS = [
  {
    id: "RECEPTION",
    title: "Réception",
    description: "Inscriptions, caisse, élèves et pointage quotidien.",
    icon: ClipboardList,
    role: "STAFF" as const,
    accessMode: "LIMITED" as const,
    permissions: RECEPTION_PERMISSIONS,
  },
  {
    id: "COACH",
    title: "Coach",
    description: "Pointage et consultation des cours utiles au terrain.",
    icon: Dumbbell,
    role: "STAFF" as const,
    accessMode: "LIMITED" as const,
    permissions: COACH_PERMISSIONS,
  },
  {
    id: "ADMIN",
    title: "Admin",
    description: "Tout le club: configuration, utilisateurs et journal.",
    icon: ShieldCheck,
    role: "ADMIN" as const,
    accessMode: "FULL" as const,
    permissions: [] as PermissionKey[],
  },
];

export function UserCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [accessMode, setAccessMode] = useState<"FULL" | "LIMITED">("LIMITED");
  const [permissions, setPermissions] = useState<PermissionKey[]>([
    "members.manage",
    "enrollment.manage",
    "attendance.manage",
  ]);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function togglePermission(key: PermissionKey) {
    setPermissions((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function applyStaffPreset(nextPermissions: PermissionKey[]) {
    setRole("STAFF");
    setAccessMode("LIMITED");
    setPermissions(nextPermissions);
  }

  function applyPreset(preset: (typeof ROLE_PRESETS)[number]) {
    setRole(preset.role);
    setAccessMode(preset.accessMode);
    setPermissions(preset.permissions);
  }

  function isPresetSelected(preset: (typeof ROLE_PRESETS)[number]) {
    if (preset.role !== role) return false;
    if (preset.role === "ADMIN") return true;
    if (accessMode !== preset.accessMode) return false;
    return (
      preset.permissions.length === permissions.length &&
      preset.permissions.every((permission) => permissions.includes(permission))
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role, password, accessMode, permissions }),
    });

    const json = await res.json();
    if (!res.ok) {
      setMessage(json?.error ?? "Erreur");
      setLoading(false);
      return;
    }

    setName("");
    setEmail("");
    setPassword("");
    setRole("STAFF");
    setAccessMode("LIMITED");
    setPermissions(["members.manage", "enrollment.manage", "attendance.manage"]);
    setMessage("Utilisateur créé");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <FeedbackMessage message={message} />
      </div>

      <fieldset className="md:col-span-2">
        <legend className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Profil de départ
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {ROLE_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const selected = isPresetSelected(preset);

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={cn(
                  "min-h-28 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
                  selected
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)] hover:border-[var(--primary)]/35",
                )}
                aria-pressed={selected}
              >
                <span className="flex items-center gap-2 text-sm font-black">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--surface)] shadow-[var(--shadow-panel)]">
                    <Icon className="size-4" />
                  </span>
                  {preset.title}
                </span>
                <span className="mt-2 block text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-[var(--foreground)]" htmlFor="name">Nom</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} className="field" required placeholder="Ex: Réception 1" />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-[var(--foreground)]" htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" required placeholder="ex: staff@club.tn" />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-[var(--foreground)]" htmlFor="role">Rôle</label>
        <select id="role" value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "STAFF")} className="field">
          <option value="STAFF">Réception / Coach</option>
          <option value="ADMIN">Admin</option>
        </select>
        <p className="text-xs text-[var(--muted-foreground)]">
          Admin gère tout le club. Réception ou Coach reçoit seulement les accès cochés.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-[var(--foreground)]" htmlFor="password">Mot de passe</label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="field" required minLength={8} placeholder="8 caractères minimum" />
      </div>

      {role === "STAFF" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4 shadow-[var(--shadow-panel)] md:col-span-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Droits Réception / Coach</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Choisissez les écrans que ce compte peut utiliser.
              </p>
            </div>
            <select
              value={accessMode}
              onChange={(e) => setAccessMode(e.target.value as "FULL" | "LIMITED")}
              className="field w-full md:max-w-48"
            >
              <option value="LIMITED">Limité</option>
              <option value="FULL">Accès complet staff</option>
            </select>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => applyStaffPreset(RECEPTION_PERMISSIONS)} className="btn btn-ghost btn-block-mobile">
              Profil Réception
            </button>
            <button type="button" onClick={() => applyStaffPreset(COACH_PERMISSIONS)} className="btn btn-ghost btn-block-mobile">
              Profil Coach
            </button>
          </div>

          {accessMode === "LIMITED" && (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {PERMISSIONS.map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={permissions.includes(key)}
                    onChange={() => togglePermission(key)}
                  />
                  <span>{PERMISSION_LABELS[key]}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <FormActions sticky className="md:col-span-2">
        <button className="btn btn-primary btn-block-mobile min-h-11" disabled={loading} type="submit">
          {loading ? "Création..." : "Créer l'utilisateur"}
        </button>
      </FormActions>
    </form>
  );
}
