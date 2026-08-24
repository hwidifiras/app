"use client";

import { FormEvent, useMemo, useState } from "react";

import { MemberDemographicsFields } from "@/components/members/member-demographics-fields";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";

type MemberEditCardProps = {
  member: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    memberType: "ADULT" | "KID" | "NOT_SPECIFIED";
    gender: "MALE" | "FEMALE" | "NOT_SPECIFIED";
    birthDate: string | null;
    address: string | null;
    parentName: string | null;
    parentPhone: string | null;
    parentAddress: string | null;
    status: "ACTIVE" | "ARCHIVED";
    joinedAt: string;
    archivedAt: string | null;
  };
};

function formatDate(date: string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("fr-FR");
}

function computeAge(date: string | null) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > parsed.getMonth() ||
    (now.getMonth() === parsed.getMonth() && now.getDate() >= parsed.getDate());
  if (!hasBirthdayPassed) {
    age -= 1;
  }
  return Math.max(0, age);
}

function memberTypeLabel(value: MemberEditCardProps["member"]["memberType"]) {
  if (value === "KID") return "Enfant";
  if (value === "ADULT") return "Adulte";
  return "Non spécifié";
}

function genderLabel(value: MemberEditCardProps["member"]["gender"]) {
  if (value === "MALE") return "Garcon / homme";
  if (value === "FEMALE") return "Fille / femme";
  return "Non specifie";
}

export function MemberEditCard({ member }: MemberEditCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(member.firstName);
  const [lastName, setLastName] = useState(member.lastName);
  const [phone, setPhone] = useState(member.phone);
  const [email, setEmail] = useState(member.email ?? "");
  const [memberType, setMemberType] = useState(member.memberType);
  const [gender, setGender] = useState(member.gender);
  const [birthDate, setBirthDate] = useState(
    member.birthDate ? member.birthDate.split("T")[0] : "",
  );
  const [address, setAddress] = useState(member.address ?? "");
  const [parentName, setParentName] = useState(member.parentName ?? "");
  const [parentPhone, setParentPhone] = useState(member.parentPhone ?? "");
  const [parentAddress, setParentAddress] = useState(member.parentAddress ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const age = useMemo(() => computeAge(member.birthDate), [member.birthDate]);
  const profileIncomplete =
    memberType === "NOT_SPECIFIED" ||
    gender === "NOT_SPECIFIED" ||
    (memberType === "KID" && (!parentName.trim() || parentPhone.trim().length < 6));

  function resetForm() {
    setFirstName(member.firstName);
    setLastName(member.lastName);
    setPhone(member.phone);
    setEmail(member.email ?? "");
    setMemberType(member.memberType);
    setGender(member.gender);
    setBirthDate(member.birthDate ? member.birthDate.split("T")[0] : "");
    setAddress(member.address ?? "");
    setParentName(member.parentName ?? "");
    setParentPhone(member.parentPhone ?? "");
    setParentAddress(member.parentAddress ?? "");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (profileIncomplete) {
      setMessage("Complétez adulte/enfant, genre et téléphone parent pour un enfant avant d'enregistrer.");
      return;
    }

    setLoading(true);
    const payload: Record<string, unknown> = {
      firstName,
      lastName,
      phone,
      email,
      memberType,
      gender,
      birthDate: birthDate ? new Date(`${birthDate}T00:00:00`).toISOString() : undefined,
      address,
      parentName: memberType === "KID" ? parentName : "",
      parentPhone: memberType === "KID" ? parentPhone : "",
      parentAddress: memberType === "KID" ? parentAddress : "",
    };

    const response = await fetch(`/api/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la mise à jour");
      setLoading(false);
      return;
    }

    setMessage("Dossier membre mis à jour");
    setLoading(false);
    setIsEditing(false);
  }

  return (
    <section className="panel h-full min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Informations</h2>
        {isEditing ? null : (
          <button type="button" className="btn btn-ghost min-h-11 px-3 text-xs" onClick={() => setIsEditing(true)}>
            Modifier
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--foreground)]">Prénom *</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="field" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--foreground)]">Nom *</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="field" required />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--foreground)]">Téléphone *</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="field" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--foreground)]">Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
              </div>
            </div>
            <MemberDemographicsFields
              memberType={memberType}
              gender={gender}
              birthDate={birthDate}
              onMemberTypeChange={setMemberType}
              onGenderChange={setGender}
              onBirthDateChange={setBirthDate}
            />
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--foreground)]">Adresse</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className="field" />
            </div>

            {memberType === "KID" ? (
              <div className="rounded-lg border border-[var(--border)] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Responsable légal
                </p>
                <div className="grid gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--foreground)]">Nom complet</label>
                    <input value={parentName} onChange={(e) => setParentName(e.target.value)} className="field" required />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--foreground)]">Téléphone</label>
                    <input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} className="field" required />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--foreground)]">Adresse</label>
                    <input value={parentAddress} onChange={(e) => setParentAddress(e.target.value)} className="field" />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <FeedbackMessage message={message} />

          <FormActions sticky>
            <button type="submit" className="btn btn-primary btn-block-mobile min-h-11" disabled={loading || profileIncomplete}>
              {loading ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block-mobile min-h-11"
              onClick={() => {
                resetForm();
                setIsEditing(false);
              }}
              disabled={loading}
            >
              Annuler
            </button>
          </FormActions>
        </form>
      ) : (
        <dl className="mt-4 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
          <div className="flex min-w-0 justify-between gap-3">
            <dt className="text-[var(--muted-foreground)]">Statut</dt>
            <dd>
              <StatusBadge variant={member.status === "ACTIVE" ? "success" : "muted"}>
                {member.status === "ACTIVE" ? "Actif" : "Archivé"}
              </StatusBadge>
            </dd>
          </div>
          <div className="flex min-w-0 justify-between gap-3">
            <dt className="text-[var(--muted-foreground)]">Téléphone</dt>
            <dd className="min-w-0 break-words text-right font-medium">{member.phone}</dd>
          </div>
          <div className="flex min-w-0 justify-between gap-3">
            <dt className="text-[var(--muted-foreground)]">Type</dt>
            <dd className="font-medium">{memberTypeLabel(member.memberType)}</dd>
          </div>
          <div className="flex min-w-0 justify-between gap-3">
            <dt className="text-[var(--muted-foreground)]">Genre</dt>
            <dd className="font-medium">{genderLabel(member.gender)}</dd>
          </div>
          <div className="flex min-w-0 justify-between gap-3">
            <dt className="text-[var(--muted-foreground)]">Date de naissance</dt>
            <dd className="font-medium">
              {formatDate(member.birthDate)}
              {age !== null ? ` (${age} ans)` : ""}
            </dd>
          </div>
          <div className="flex min-w-0 justify-between gap-3">
            <dt className="text-[var(--muted-foreground)]">Adresse</dt>
            <dd className="min-w-0 break-words text-right font-medium">{member.address ?? "-"}</dd>
          </div>
          <div className="flex min-w-0 justify-between gap-3">
            <dt className="text-[var(--muted-foreground)]">Email</dt>
            <dd className="min-w-0 break-all text-right font-medium">{member.email ?? "-"}</dd>
          </div>
          <div className="flex min-w-0 justify-between gap-3">
            <dt className="text-[var(--muted-foreground)]">Inscription</dt>
            <dd className="font-medium">{formatDate(member.joinedAt)}</dd>
          </div>
          {member.archivedAt ? (
            <div className="flex min-w-0 justify-between gap-3">
              <dt className="text-[var(--muted-foreground)]">Archivé le</dt>
              <dd className="font-medium text-[var(--danger)]">{formatDate(member.archivedAt)}</dd>
            </div>
          ) : null}
          {member.memberType === "KID" ? (
            <div className="rounded-lg border border-[var(--border)] p-3 text-xs sm:col-span-2 lg:col-span-1">
              <p className="mb-2 text-[var(--muted-foreground)]">Responsable légal</p>
              <p className="font-medium">{member.parentName ?? "-"}</p>
              <p className="text-[var(--muted-foreground)]">{member.parentPhone ?? "-"}</p>
              <p className="text-[var(--muted-foreground)]">{member.parentAddress ?? "-"}</p>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}
