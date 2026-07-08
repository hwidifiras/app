export type DataImportMemberDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  memberType: "ADULT" | "KID" | "NOT_SPECIFIED";
  gender: "MALE" | "FEMALE" | "NOT_SPECIFIED";
  birthDate: string;
  address: string;
  parentName: string;
  parentPhone: string;
};

type DataImportMemberSectionProps = {
  member: DataImportMemberDraft;
  onMemberChange: <K extends keyof DataImportMemberDraft>(key: K, value: DataImportMemberDraft[K]) => void;
};

export function DataImportMemberSection({
  member,
  onMemberChange,
}: DataImportMemberSectionProps) {
  return (
    <section id="reprise-identity" className="form-section-anchor panel p-4 sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">1. Identité</p>
        <h2 className="mt-1 text-lg font-semibold">Membre à importer</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium">
          Prénom *
          <input
            className="field mt-1"
            value={member.firstName}
            onChange={(event) => onMemberChange("firstName", event.target.value)}
            required
          />
        </label>
        <label className="text-sm font-medium">
          Nom *
          <input
            className="field mt-1"
            value={member.lastName}
            onChange={(event) => onMemberChange("lastName", event.target.value)}
            required
          />
        </label>
        <label className="text-sm font-medium">
          Type *
          <select
            className="field mt-1"
            value={member.memberType}
            onChange={(event) => onMemberChange("memberType", event.target.value as DataImportMemberDraft["memberType"])}
          >
            <option value="ADULT">Adulte</option>
            <option value="KID">Enfant</option>
            <option value="NOT_SPECIFIED">Non précisé</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Genre *
          <select
            className="field mt-1"
            value={member.gender}
            onChange={(event) => onMemberChange("gender", event.target.value as DataImportMemberDraft["gender"])}
            required
          >
            <option value="NOT_SPECIFIED">Non précisé</option>
            <option value="MALE">Garçon / homme</option>
            <option value="FEMALE">Fille / femme</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Téléphone
          <input
            className="field mt-1"
            value={member.phone}
            onChange={(event) => onMemberChange("phone", event.target.value)}
          />
        </label>
        <label className="text-sm font-medium">
          Email
          <input
            type="email"
            className="field mt-1"
            value={member.email}
            onChange={(event) => onMemberChange("email", event.target.value)}
          />
        </label>
        {member.memberType === "KID" ? (
          <>
            <label className="text-sm font-medium">
              Nom du parent
              <input
                className="field mt-1"
                value={member.parentName}
                onChange={(event) => onMemberChange("parentName", event.target.value)}
              />
            </label>
            <label className="text-sm font-medium">
              Téléphone du parent *
              <input
                className="field mt-1"
                value={member.parentPhone}
                onChange={(event) => onMemberChange("parentPhone", event.target.value)}
                required
              />
            </label>
          </>
        ) : null}
      </div>
    </section>
  );
}
