"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { FeedbackMessage } from "@/components/ui/feedback-message";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => {
    const raw = searchParams.get("next");
    return raw && raw.startsWith("/") ? raw : "/";
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

      <p className="text-xs text-[var(--muted-foreground)]">
        Si vous n&apos;avez pas encore de compte, créez d&apos;abord un utilisateur ADMIN via seed.
      </p>
    </form>
  );
}
