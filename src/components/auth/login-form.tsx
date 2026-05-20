"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { FeedbackMessage } from "@/components/ui/feedback-message";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registrationSuccess = searchParams.get("registered") === "1";
  const resetSuccess = searchParams.get("reset") === "1";

  const nextPath = useMemo(() => {
    const raw = searchParams.get("next");
    return raw && raw.startsWith("/") ? raw : "/";
  }, [searchParams]);

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(
    registrationSuccess
      ? "Compte créé. Connectez-vous avec votre email et votre mot de passe."
      : resetSuccess
        ? "Mot de passe réinitialisé. Connectez-vous avec votre nouveau mot de passe."
        : null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();

    if (!res.ok) {
      setMessage(json?.error ?? "Erreur de connexion");
      setLoading(false);
      return;
    }

    router.replace(nextPath);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FeedbackMessage message={message} />

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-semibold text-[var(--foreground)]">
          Email
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

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-semibold text-[var(--foreground)]">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field"
          placeholder="••••••••"
        />
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Connexion..." : "Se connecter"}
      </button>

      <Link href="/forgot-password" className="block text-center text-xs text-[var(--muted-foreground)] underline">
        Mot de passe oublié ?
      </Link>

      <p className="text-xs text-[var(--muted-foreground)]">
        Pas encore de compte ? Demandez à un administrateur de vous créer un accès dans Paramètres → Utilisateurs.
      </p>
    </form>
  );
}
