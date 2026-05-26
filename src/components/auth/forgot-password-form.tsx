"use client";

import { useState } from "react";
import Link from "next/link";

import { FeedbackMessage } from "@/components/ui/feedback-message";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setResetUrl(null);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(json?.error ?? "Erreur");
      return;
    }

    if (json?.data?.emailConfigured === false) {
      setMessage(
        json?.data?.emailError === "EMAIL_SEND_FAILED"
          ? "L'email n'a pas pu être envoyé. Réessayez plus tard ou contactez l'administrateur."
          : json?.data?.emailError === "EMAIL_NOT_CONFIGURED"
            ? "L'envoi d'email n'est pas configuré sur le serveur."
            : "L'email n'a pas pu être envoyé.",
      );
      setResetUrl(json?.data?.resetUrl ?? null);
      return;
    }

    setMessage("Si ce compte existe, un email de réinitialisation a été envoyé.");
    setResetUrl(null);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FeedbackMessage message={message} />

      {resetUrl && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Email non configuré en local. Lien de test:{" "}
          <Link href={resetUrl} className="font-medium underline underline-offset-4">
            réinitialiser
          </Link>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-semibold text-[var(--foreground)]">
          Email du compte
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field"
          placeholder="ex: reception@club.tn"
        />
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Envoi..." : "Envoyer le lien"}
      </button>

      <Link href="/login" className="block text-center text-xs text-[var(--muted-foreground)] underline">
        Retour à la connexion
      </Link>
    </form>
  );
}
