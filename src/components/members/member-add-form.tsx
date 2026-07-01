"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";

type GroupOption = { id: string; name: string };
type PlanOption = { id: string; name: string; price: number; totalSessions: number; validityDays: number };

type MemberAddFormProps = {
  groupsOptions: GroupOption[];
  plansOptions: PlanOption[];
};

export function MemberAddForm({ groupsOptions, plansOptions }: MemberAddFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [memberType, setMemberType] = useState<"ADULT" | "KID" | "NOT_SPECIFIED">("ADULT");
  const [birthDate, setBirthDate] = useState("");
  const [address, setAddress] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentAddress, setParentAddress] = useState("");
  const [groupId, setGroupId] = useState("");
  const [planId, setPlanId] = useState("");
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("CASH");
    const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [paymentNotes, setPaymentNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const computedAge = birthDate
    ? Math.max(0, new Date().getFullYear() - new Date(birthDate).getFullYear())
    : null;

  const selectedPlan = plansOptions.find((p) => p.id === planId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const paymentCents = Math.round(parseFloat(paymentAmount.replace(",", ".")) * 100) || 0;

    const payload: Record<string, unknown> = {
      firstName,
      lastName,
      phone,
      email,
      memberType,
      birthDate: new Date(`${birthDate}T00:00:00`).toISOString(),
      address,
      parentName: memberType === "KID" ? parentName : "",
      parentPhone: memberType === "KID" ? parentPhone : "",
      parentAddress: memberType === "KID" ? parentAddress : "",
    };
    payload.groupId = groupId;
    payload.subscriptionPlanId = planId;
    if (paymentCents > 0) {
      payload.paymentAmount = paymentCents;
      payload.paymentMethod = paymentMethod;
      payload.paymentDate = paymentDate ? new Date(paymentDate).toISOString() : undefined;
      payload.paymentNotes = paymentNotes;
    }

    const response = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la création du membre");
      setLoading(false);
      return;
    }

    const memberId = result.data?.id as string | undefined;
    router.push(memberId ? `/members/${memberId}` : "/members");
    router.refresh();
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
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Type de membre *</label>
          <select value={memberType} onChange={(e) => setMemberType(e.target.value as typeof memberType)} className="field" required>
            <option value="ADULT">Adulte</option>
            <option value="KID">Enfant</option>
            <option value="NOT_SPECIFIED">Non spécifié</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Date de naissance *</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="field"
            required
          />
          {computedAge !== null ? (
            <p className="mt-1 text-[0.7rem] text-[var(--muted-foreground)]">Âge estimé: {computedAge} ans</p>
          ) : null}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Adresse</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Adresse"
          className="field"
        />
      </div>

      {memberType === "KID" ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Responsable légal
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Nom complet du parent</label>
              <input
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Nom du parent"
                className="field"
                required={memberType === "KID"}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Téléphone du parent</label>
              <input
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="06 00 00 00 00"
                className="field"
                required={memberType === "KID"}
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Adresse du parent</label>
            <input
              value={parentAddress}
              onChange={(e) => setParentAddress(e.target.value)}
              placeholder="Adresse"
              className="field"
              required
            />
          </div>
        </div>
      ) : null}

      <div className="border-t border-[var(--border)] pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Affectation & Abonnement
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Groupe</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="field"
            >
              <option value="">Aucun</option>
              {groupsOptions.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Plan d&apos;abonnement</label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="field"
              required
            >
              <option value="">Sélectionner un plan</option>
              {plansOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(p.price / 100)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedPlan && (
          <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-xs text-[var(--muted-foreground)]">
              <span className="font-medium text-[var(--foreground)]">{selectedPlan.name}</span> —{" "}
              {selectedPlan.totalSessions} séances — Validité {selectedPlan.validityDays} jours —{" "}
              {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(selectedPlan.price / 100)}
            </p>
          </div>
        )}

        {selectedPlan ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Paiement à l&apos;inscription (optionnel)
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Montant (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="field"
                  placeholder="Ex: 49.90"
                />
                <p className="mt-1 text-[0.7rem] text-[var(--muted-foreground)]">
                  Montant dû: {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(selectedPlan.price / 100)}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Méthode</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="field">
                  <option value="CASH">Espèces</option>
                  <option value="CARD">Carte bancaire</option>
                  <option value="TRANSFER">Virement</option>
                  <option value="CHECK">Chèque</option>
                </select>
              </div>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Date de paiement</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Notes</label>
                <input
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="field"
                  placeholder="Remarque..."
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <FeedbackMessage message={message} />

      <FormActions sticky>
        <button type="button" onClick={() => router.push("/members")} className="btn btn-ghost btn-block-mobile">
          Annuler
        </button>
        <button type="submit" disabled={loading} className="btn btn-primary btn-block-mobile">
          {loading ? "Enregistrement..." : "Inscrire membre"}
        </button>
      </FormActions>
    </form>
  );
}
