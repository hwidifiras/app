"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";
import { PERMISSION_LABELS, PERMISSIONS, type PermissionKey } from "@/lib/permission-definitions";

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
          <option value="STAFF">Staff</option>
          <option value="ADMIN">Admin</option>
        </select>
        <p className="text-xs text-[var(--muted-foreground)]">
          Admin gère tout le club. Staff reçoit seulement les accès cochés.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-[var(--foreground)]" htmlFor="password">Mot de passe</label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="field" required minLength={8} placeholder="8 caractères minimum" />
      </div>

      {role === "STAFF" && (
        <div className="md:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Droits du staff</p>
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
