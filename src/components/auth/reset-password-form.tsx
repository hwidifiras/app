"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { FeedbackMessage } from "@/components/ui/feedback-message";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(json?.error ?? "Erreur");
      return;
    }

    router.replace("/login?reset=1");
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <FeedbackMessage message="Lien de réinitialisation manquant." />
        <Link href="/forgot-password" className="btn btn-primary w-full">
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FeedbackMessage message={message} />

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-semibold text-[var(--foreground)]">
          Nouveau mot de passe
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field"
          placeholder="8 caractères minimum"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="text-sm font-semibold text-[var(--foreground)]">
          Confirmer le mot de passe
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="field"
          placeholder="Répéter le mot de passe"
        />
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Réinitialisation..." : "Changer le mot de passe"}
      </button>
    </form>
  );
}
