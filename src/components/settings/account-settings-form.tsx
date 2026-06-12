"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Pencil } from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions, FormField, FormGrid, FormSection } from "@/components/ui/form-layout";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ThemeToggle } from "@/components/theme/theme-toggle";

type AccountData = {
  email: string;
  name: string;
};

export function AccountSettingsForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountData | null>(null);

  const [name, setName] = useState("");
  const [emailEditOpen, setEmailEditOpen] = useState(false);
  const [emailPassword, setEmailPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [passwordEditOpen, setPasswordEditOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/account")
      .then(async (res) => {
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.data) {
          setMessage(json?.error ?? "Impossible de charger le compte");
          return;
        }
        setAccount(json.data);
        setName(json.data.name);
        setNewEmail(json.data.email);
      })
      .catch(() => {
        if (!cancelled) setMessage("Impossible de charger le compte");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function closeEmailEdit() {
    setEmailEditOpen(false);
    setEmailPassword("");
    setNewEmail(account?.email ?? "");
  }

  function closePasswordEdit() {
    setPasswordEditOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!account || name.trim() === account.name) {
      setMessage("Aucune modification sur le nom");
      return;
    }

    setSavingName(true);
    setMessage(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const json = await res.json();
    setSavingName(false);

    if (!res.ok) {
      setMessage(json?.error ?? "Erreur lors de la mise à jour");
      return;
    }

    setAccount(json.data);
    setName(json.data.name);
    setMessage("Nom mis à jour avec succès");
    router.refresh();
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;

    const trimmed = newEmail.trim().toLowerCase();
    if (trimmed === account.email) {
      setMessage("Le nouvel email est identique à l'actuel");
      return;
    }
    if (!emailPassword) {
      setMessage("Entrez votre mot de passe actuel pour modifier l'email");
      return;
    }

    setSavingEmail(true);
    setMessage(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: trimmed,
        currentPassword: emailPassword,
      }),
    });
    const json = await res.json();
    setSavingEmail(false);

    if (!res.ok) {
      setMessage(json?.error ?? "Erreur lors de la mise à jour de l'email");
      return;
    }

    setAccount(json.data);
    setNewEmail(json.data.email);
    closeEmailEdit();
    setMessage("Email mis à jour avec succès");
    router.refresh();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();

    if (!currentPassword) {
      setMessage("Entrez votre mot de passe actuel");
      return;
    }
    if (newPassword.length < 8) {
      setMessage("Le nouveau mot de passe doit contenir au moins 8 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Les nouveaux mots de passe ne correspondent pas");
      return;
    }

    setSavingPassword(true);
    setMessage(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    });
    const json = await res.json();
    setSavingPassword(false);

    if (!res.ok) {
      setMessage(json?.error ?? "Erreur lors du changement de mot de passe");
      return;
    }

    closePasswordEdit();
    setMessage("Mot de passe mis à jour avec succès");
    router.refresh();
  }

  if (loading) {
    return <LoadingSkeleton lines={4} />;
  }

  if (!account) {
    return <FeedbackMessage message={message} />;
  }

  const emailUnlocked = emailEditOpen && emailPassword.length > 0;

  return (
    <div className="space-y-4">
      <FeedbackMessage message={message} variant={message?.includes("succès") ? "success" : undefined} />

      <FormSection title="Informations personnelles" description="Ces informations identifient votre compte dans l'application.">
        <form onSubmit={saveName} className="space-y-4">
          <FormField label="Nom affiché">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </FormField>
          <FormActions>
            <button type="submit" className="btn btn-primary btn-block-mobile min-h-11" disabled={savingName}>
              {savingName ? "Enregistrement…" : "Enregistrer le nom"}
            </button>
          </FormActions>
        </form>

        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <FormField label="Email de connexion">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="field flex min-h-[2.75rem] flex-1 items-center bg-[var(--surface-soft)] text-[var(--foreground)]">
                {account.email}
              </p>
              {!emailEditOpen ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-block-mobile shrink-0"
                  onClick={() => {
                    setEmailEditOpen(true);
                    setNewEmail(account.email);
                    setEmailPassword("");
                  }}
                >
                  <Pencil className="size-4" />
                  Modifier l&apos;email
                </button>
              ) : null}
            </div>
          </FormField>

          {emailEditOpen ? (
            <form onSubmit={saveEmail} className="mt-3 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/60 p-3.5">
              <FormField label="Mot de passe actuel">
                <input
                  className="field"
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Confirmez votre identité"
                  required
                />
              </FormField>

              {emailUnlocked ? (
                <FormField label="Nouvel email">
                  <input
                    className="field"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </FormField>
              ) : (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Saisissez votre mot de passe actuel pour déverrouiller le changement d&apos;email.
                </p>
              )}

              <FormActions className="mt-0">
                <button
                  type="submit"
                  className="btn btn-primary btn-block-mobile min-h-11"
                  disabled={savingEmail || !emailUnlocked || newEmail.trim().toLowerCase() === account.email}
                >
                  <Mail className="size-4" />
                  {savingEmail ? "Enregistrement…" : "Enregistrer l'email"}
                </button>
                <button type="button" className="btn btn-ghost btn-block-mobile min-h-11" onClick={closeEmailEdit}>
                  Annuler
                </button>
              </FormActions>
            </form>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="Apparence" description="Choisissez le thème le plus confortable pour votre écran.">
        <ThemeToggle />
      </FormSection>

      <FormSection title="Sécurité" description="Utilisez un mot de passe unique d'au moins 8 caractères.">
        {!passwordEditOpen ? (
          <button type="button" className="btn btn-ghost btn-block-mobile" onClick={() => setPasswordEditOpen(true)}>
            <Pencil className="size-4" />
            Modifier le mot de passe
          </button>
        ) : (
          <form onSubmit={savePassword} className="space-y-3">
            <FormGrid>
              <FormField label="Mot de passe actuel">
                <input
                  className="field"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </FormField>
              <FormField label="Nouveau mot de passe">
                <input
                  className="field"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="Min. 8 caractères"
                  required
                />
              </FormField>
              <FormField label="Confirmer le nouveau mot de passe" className="sm:col-span-2">
                <input
                  className="field"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </FormField>
            </FormGrid>
            <FormActions className="mt-0 border-t-0 pt-0">
              <button type="button" className="btn btn-ghost btn-block-mobile" onClick={closePasswordEdit}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary btn-block-mobile" disabled={savingPassword}>
                {savingPassword ? "Enregistrement…" : "Enregistrer le mot de passe"}
              </button>
            </FormActions>
          </form>
        )}
      </FormSection>
    </div>
  );
}
