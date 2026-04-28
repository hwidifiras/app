"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackMessage } from "@/components/ui/feedback-message";

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
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Prénom *</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="ex: Mohamed"
            className="field"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Nom *</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="ex: Benali"
            className="field"
            required
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Téléphone *</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="06 00 00 00 00"
          className="field"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="optionnel"
          className="field"
        />
      </div>

      <FeedbackMessage message={message} />

      <div className="flex items-center gap-3 pt-1">
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
    </form>
  );
}
