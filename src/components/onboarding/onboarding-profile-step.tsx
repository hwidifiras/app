"use client";

import { useState } from "react";
import { ArrowRight, Building2, Loader2, MapPin, Phone } from "lucide-react";

import { CLUB_DAY_SHORT_LABELS, WORKING_DAY_ORDER, type ClubDay } from "@/lib/club-working-days";
import { cn } from "@/lib/utils";
import type { OnboardingProfileInput, TenantOnboardingState } from "@/components/onboarding/onboarding-types";

export function OnboardingProfileStep({
  state,
  saving,
  onContinue,
}: {
  state: TenantOnboardingState;
  saving: boolean;
  onContinue: (input: OnboardingProfileInput) => Promise<void>;
}) {
  const [clubName, setClubName] = useState(state.club.name);
  const [clubPhone, setClubPhone] = useState(state.club.phone);
  const [clubAddress, setClubAddress] = useState(state.club.address);
  const [workingDays, setWorkingDays] = useState<ClubDay[]>(state.club.workingDays);

  function toggleDay(day: ClubDay) {
    setWorkingDays((current) => current.includes(day)
      ? current.length > 1 ? current.filter((entry) => entry !== day) : current
      : WORKING_DAY_ORDER.filter((entry) => [...current, day].includes(entry)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await onContinue({
      action: "PROFILE",
      clubName,
      clubPhone,
      clubAddress,
      workingDays,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="onboarding-club-name" className="text-sm font-semibold">Nom affiché du club</label>
          <div className="field-control"><Building2 className="field-control-icon" /><input id="onboarding-club-name" className="field has-leading-icon" value={clubName} onChange={(event) => setClubName(event.target.value)} minLength={2} maxLength={120} required autoFocus /></div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="onboarding-club-phone" className="text-sm font-semibold">Téléphone</label>
          <div className="field-control"><Phone className="field-control-icon" /><input id="onboarding-club-phone" className="field has-leading-icon" type="tel" value={clubPhone} onChange={(event) => setClubPhone(event.target.value)} maxLength={40} placeholder="+216 20 000 000" /></div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="onboarding-club-address" className="text-sm font-semibold">Ville ou adresse</label>
          <div className="field-control"><MapPin className="field-control-icon" /><input id="onboarding-club-address" className="field has-leading-icon" value={clubAddress} onChange={(event) => setClubAddress(event.target.value)} maxLength={240} placeholder="Tunis" /></div>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Jours d’ouverture</legend>
        <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">Le planning masque les jours fermés. Vous pourrez définir plusieurs horaires par jour ensuite.</p>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {WORKING_DAY_ORDER.map((day) => {
            const selected = workingDays.includes(day);
            return (
              <button key={day} type="button" aria-pressed={selected} onClick={() => toggleDay(day)} className={cn("min-h-11 rounded-lg border px-2 text-xs font-bold transition", selected ? "border-[var(--primary)] bg-[var(--info-surface)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]")}>
                {CLUB_DAY_SHORT_LABELS[day]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex justify-end border-t border-[var(--border)] pt-4">
        <button type="submit" className="btn btn-primary btn-lg w-full sm:w-auto" disabled={saving || clubName.trim().length < 2}>
          {saving ? <><Loader2 className="size-4 animate-spin" />Enregistrement...</> : <>Continuer<ArrowRight className="size-4" /></>}
        </button>
      </div>
    </form>
  );
}
