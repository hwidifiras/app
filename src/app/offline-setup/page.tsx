"use client";

import { useState } from "react";

export default function OfflineSetupPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/offline/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(fields)) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Installation impossible.");
      window.location.assign("/login");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Installation impossible."); setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-background p-6">
    <section className="w-full max-w-lg rounded-xl border bg-card p-8 shadow-lg">
      <p className="text-sm font-semibold text-primary">All in Gym · Hors connexion</p>
      <h1 className="mt-3 text-2xl font-bold">Bienvenue dans votre club</h1>
      <p className="mt-3 text-sm text-muted-foreground">Créez votre compte administrateur. Vos membres, paiements et activités seront enregistrés sur cet ordinateur.</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <label className="block">Nom du club<input className="field mt-1" name="clubName" defaultValue="All in Gym" required maxLength={100} /></label>
        <label className="block">Votre nom<input className="field mt-1" name="name" required minLength={2} maxLength={80} autoComplete="name" /></label>
        <label className="block">Email de connexion<input className="field mt-1" name="email" type="email" required autoComplete="username" /></label>
        <label className="block">Mot de passe<input className="field mt-1" name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /><span className="text-xs text-muted-foreground">Au moins 12 caractères.</span></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Création…" : "Créer mon espace local"}</button>
      </form>
    </section>
  </main>;
}
