"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function MemberAddForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, phone, email }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la création du membre");
      setLoading(false);
      return;
    }

    setMessage("Membre créé avec succès");
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setLoading(false);

    setTimeout(() => {
      router.push("/members");
    }, 800);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Prénom"
          className="field"
          required
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Nom"
          className="field"
          required
        />
      </div>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Téléphone"
        className="field"
        required
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (optionnel)"
        className="field"
      />

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Enregistrement..." : "Créer membre"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/members")}
          className="btn btn-ghost"
        >
          Annuler
        </button>
      </div>

      {message ? (
        <p className={`text-sm ${message.includes("succès") ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
