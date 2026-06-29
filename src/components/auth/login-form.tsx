"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { cn } from "@/lib/utils";

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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(
    registrationSuccess
      ? "Compte cree. Connectez-vous avec votre email et votre mot de passe."
      : resetSuccess
        ? "Mot de passe reinitialise. Connectez-vous avec votre nouveau mot de passe."
        : null,
  );
  const [messageVariant, setMessageVariant] = useState<"success" | "error" | "info" | undefined>(
    registrationSuccess || resetSuccess ? "success" : undefined,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setMessageVariant(undefined);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();

    if (!res.ok) {
      setMessage(json?.error ?? "Erreur de connexion");
      setMessageVariant("error");
      setLoading(false);
      return;
    }

    router.replace(nextPath);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FeedbackMessage message={message} variant={messageVariant} />

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-semibold text-[#0B1220]">
          Email
        </label>
        <div className="field-control">
          <Mail className="field-control-icon" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            disabled={loading}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field has-leading-icon"
            placeholder="reception@club.tn"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="password" className="text-sm font-semibold text-[#0B1220]">
            Mot de passe
          </label>
          <Link href="/forgot-password" className="text-xs font-semibold text-[#2563EB] hover:underline">
            Oublie ?
          </Link>
        </div>
        <div className="field-control">
          <LockKeyhole className="field-control-icon" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field has-leading-icon has-trailing-action"
            placeholder="Votre mot de passe"
          />
          <button
            type="button"
            className="field-control-action hover:bg-[#EFF6FF] hover:text-[#2563EB]"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            disabled={loading}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        className={cn("btn btn-primary min-h-12 w-full text-[0.95rem]", loading && "translate-y-0")}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Connexion...
          </>
        ) : (
          <>
            Se connecter
            <ArrowRight className="size-4" />
          </>
        )}
      </button>

      <p className="rounded-lg border border-[#D8E2F0] bg-[#F8FAFC] px-3 py-2.5 text-xs leading-5 text-[#64748B]">
        Pas encore de compte ? Demandez a un administrateur de creer votre acces dans Parametres puis Utilisateurs.
      </p>
    </form>
  );
}
