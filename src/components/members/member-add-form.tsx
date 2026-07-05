"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MemberDemographicsFields } from "@/components/members/member-demographics-fields";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";
import { formatMoney } from "@/lib/money";

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
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "NOT_SPECIFIED">("NOT_SPECIFIED");
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

  const selectedPlan = plansOptions.find((p) => p.id === planId);
  const profileIncomplete =
    memberType === "NOT_SPECIFIED" ||
    gender === "NOT_SPECIFIED" ||
    (memberType === "KID" && (!parentName.trim() || parentPhone.trim().length < 6));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (profileIncomplete) {
      setMessage("Complétez adulte/enfant, genre et téléphone parent pour un enfant avant d'inscrire.");
      return;
    }

    setLoading(true);
    const paymentCents = Math.round(parseFloat(paymentAmount.replace(",", ".")) * 100) || 0;

    const payload: Record<string, unknown> = {
      firstName,
      lastName,
      phone,
      email,
      memberType,
      gender,
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
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
            {memberType === "KID" ? "Téléphone élève" : "Téléphone *"}
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="06 00 00 00 00"
            className="field"
            required={memberType !== "KID"}
          />
          {memberType === "KID" ? (
            <p className="mt-1 text-[0.7rem] text-[var(--muted-foreground)]">
              Optionnel pour un enfant: le téléphone parent devient le contact principal.
            </p>
          ) : null}
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

      <MemberDemographicsFields
        memberType={memberType}
        gender={gender}
        birthDate={birthDate}
        onMemberTypeChange={setMemberType}
        onGenderChange={setGender}
        onBirthDateChange={setBirthDate}
        birthDateRequired
      />

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
              <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Téléphone du parent *</label>
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
                  {p.name} — {formatMoney(p.price)}
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
              {formatMoney(selectedPlan.price)}
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
                <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Montant (TND)</label>
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
                  Montant dû: {formatMoney(selectedPlan.price)}
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
        <button type="submit" disabled={loading || profileIncomplete} className="btn btn-primary btn-block-mobile">
          {loading ? "Enregistrement..." : "Inscrire membre"}
        </button>
      </FormActions>
    </form>
  );
}
