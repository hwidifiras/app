"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { FeedbackMessage } from "@/components/ui/feedback-message";

export function UserCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role, password }),
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
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-[var(--foreground)]" htmlFor="password">Mot de passe</label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="field" required minLength={8} placeholder="Min 8 caractères" />
      </div>

      <div className="md:col-span-2 flex justify-end">
        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading ? "Création..." : "Créer l'utilisateur"}
        </button>
      </div>
    </form>
  );
}
