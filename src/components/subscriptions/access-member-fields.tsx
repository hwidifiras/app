import { FormField, FormGrid } from "@/components/ui/form-layout";

export type AccessNewMember = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  memberType: "ADULT" | "KID";
  gender: "MALE" | "FEMALE";
  birthDate: string;
  parentName: string;
  parentPhone: string;
};

export const EMPTY_ACCESS_MEMBER: AccessNewMember = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  memberType: "ADULT",
  gender: "MALE",
  birthDate: "",
  parentName: "",
  parentPhone: "",
};

export function AccessMemberFields({ value, onChange }: { value: AccessNewMember; onChange: (value: AccessNewMember) => void }) {
  const set = <K extends keyof AccessNewMember>(key: K, next: AccessNewMember[K]) => onChange({ ...value, [key]: next });
  return (
    <div className="space-y-4">
      <FormGrid>
        <FormField label="Prenom *"><input className="field" value={value.firstName} onChange={(event) => set("firstName", event.target.value)} required /></FormField>
        <FormField label="Nom *"><input className="field" value={value.lastName} onChange={(event) => set("lastName", event.target.value)} required /></FormField>
        <FormField label="Telephone *"><input className="field" value={value.phone} onChange={(event) => set("phone", event.target.value)} required={value.memberType === "ADULT"} /></FormField>
        <FormField label="Email"><input className="field" type="email" value={value.email} onChange={(event) => set("email", event.target.value)} /></FormField>
        <FormField label="Date de naissance *"><input className="field" type="date" value={value.birthDate} onChange={(event) => set("birthDate", event.target.value)} required /></FormField>
      </FormGrid>
      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset><legend className="mb-2 text-xs font-medium">Public *</legend><div className="grid grid-cols-2 gap-2">{(["ADULT", "KID"] as const).map((option) => <label key={option} className={`flex min-h-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold ${value.memberType === option ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)]"}`}><input className="sr-only" type="radio" checked={value.memberType === option} onChange={() => set("memberType", option)} />{option === "ADULT" ? "Adulte" : "Enfant"}</label>)}</div></fieldset>
        <fieldset><legend className="mb-2 text-xs font-medium">Genre *</legend><div className="grid grid-cols-2 gap-2">{(["MALE", "FEMALE"] as const).map((option) => <label key={option} className={`flex min-h-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold ${value.gender === option ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)]"}`}><input className="sr-only" type="radio" checked={value.gender === option} onChange={() => set("gender", option)} />{option === "MALE" ? "Homme" : "Femme"}</label>)}</div></fieldset>
      </div>
      {value.memberType === "KID" ? <FormGrid><FormField label="Nom du parent *"><input className="field" value={value.parentName} onChange={(event) => set("parentName", event.target.value)} required /></FormField><FormField label="Telephone du parent *"><input className="field" value={value.parentPhone} onChange={(event) => set("parentPhone", event.target.value)} required /></FormField></FormGrid> : null}
    </div>
  );
}
