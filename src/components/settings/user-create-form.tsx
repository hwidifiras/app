"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  UserAccessFields,
  type CoachAccountOption,
  type UserAccessValue,
} from "@/components/settings/user-access-fields";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";
import { STAFF_ACCESS_PRESETS } from "@/lib/user-access-presets";
import type { ProductProfile } from "@/platform/product/product-context";

function initialAccess(profile: ProductProfile): UserAccessValue {
  const preset = profile === "GYM_ONLY"
    ? STAFF_ACCESS_PRESETS.RECEPTION_GYM
    : profile === "HYBRID"
      ? STAFF_ACCESS_PRESETS.RECEPTION_HYBRID
      : STAFF_ACCESS_PRESETS.RECEPTION_CLASS;
  return {
    role: "STAFF",
    accessMode: "LIMITED",
    permissions: [...preset.permissions],
    coachId: null,
  };
}

export function UserCreateForm({
  coaches,
  productProfile,
}: {
  coaches: CoachAccountOption[];
  productProfile: ProductProfile;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [access, setAccess] = useState<UserAccessValue>(() => initialAccess(productProfile));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, ...access }),
    });
    const json = await response.json();
    if (!response.ok) {
      setMessage(json?.error ?? "Erreur");
      setLoading(false);
      return;
    }

    setName("");
    setEmail("");
    setPassword("");
    setAccess(initialAccess(productProfile));
    setMessage("Utilisateur créé");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <FeedbackMessage message={message} variant={message === "Utilisateur créé" ? "success" : undefined} />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-[var(--foreground)]" htmlFor="name">Nom</label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="field"
          required
          placeholder="Ex: Réception 1"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-[var(--foreground)]" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="field"
          required
          placeholder="ex: staff@club.tn"
        />
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <label className="text-sm font-semibold text-[var(--foreground)]" htmlFor="password">Mot de passe provisoire</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="field"
          required
          minLength={8}
          placeholder="8 caractères minimum"
        />
      </div>

      <div className="md:col-span-2">
        <UserAccessFields
          value={access}
          onChange={setAccess}
          coaches={coaches}
          productProfile={productProfile}
        />
      </div>

      <FormActions sticky className="md:col-span-2">
        <button className="btn btn-primary btn-block-mobile min-h-11" disabled={loading} type="submit">
          {loading ? "Création..." : "Créer l'utilisateur"}
        </button>
      </FormActions>
    </form>
  );
}
