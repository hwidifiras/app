import { FormField, FormGrid, FormSection } from "@/components/ui/form-layout";

type ClubIdentitySectionProps = {
  clubName: string;
  clubLogoUrl: string;
  logoUploading: boolean;
  clubAddress: string;
  clubPhone: string;
  onClubNameChange: (value: string) => void;
  onClubAddressChange: (value: string) => void;
  onClubPhoneChange: (value: string) => void;
  onUploadLogo: (file: File) => void;
  onRemoveLogo: () => void;
};

export function ClubIdentitySection({
  clubName,
  clubLogoUrl,
  logoUploading,
  clubAddress,
  clubPhone,
  onClubNameChange,
  onClubAddressChange,
  onClubPhoneChange,
  onUploadLogo,
  onRemoveLogo,
}: ClubIdentitySectionProps) {
  return (
    <FormSection
      id="club-identity"
      title="Identité du club"
      description="Ces informations apparaissent dans l'application et sur les écrans d'accueil."
    >
      <FormGrid>
        <FormField
          label="Nom du club"
          htmlFor="clubName"
          hint="Laissez vide pour conserver le nom actuel de l'application."
          className="md:col-span-2"
        >
          <input
            id="clubName"
            className="field"
            value={clubName}
            onChange={(event) => onClubNameChange(event.target.value)}
            placeholder="Ex. Club Karaté Tunis"
          />
        </FormField>
        <FormField label="Logo du club" htmlFor="clubLogoFile" hint="Image PNG, JPEG ou WebP, jusqu'à 1 Mo." className="md:col-span-2">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-[var(--surface-soft)] shadow-[var(--shadow-panel)]">
              {clubLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clubLogoUrl} alt="" className="size-full object-contain p-1" />
              ) : (
                <span className="text-xs text-muted-foreground">Aucun</span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <input
                id="clubLogoFile"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={logoUploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUploadLogo(file);
                  event.target.value = "";
                }}
              />
              <label
                htmlFor="clubLogoFile"
                className={`btn btn-primary btn-block-mobile inline-flex min-h-11 cursor-pointer items-center justify-center text-sm sm:w-fit ${
                  logoUploading ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {logoUploading ? "Importation…" : "Choisir une image"}
              </label>
              {clubLogoUrl ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-block-mobile min-h-11 text-sm sm:w-fit"
                  disabled={logoUploading}
                  onClick={onRemoveLogo}
                >
                  Supprimer le logo
                </button>
              ) : null}
            </div>
          </div>
        </FormField>
        <FormField label="Adresse" htmlFor="clubAddress">
          <input
            id="clubAddress"
            className="field"
            value={clubAddress}
            onChange={(event) => onClubAddressChange(event.target.value)}
            placeholder="Rue, ville"
          />
        </FormField>
        <FormField label="Téléphone" htmlFor="clubPhone">
          <input
            id="clubPhone"
            className="field"
            value={clubPhone}
            onChange={(event) => onClubPhoneChange(event.target.value)}
            placeholder="+216 ..."
            inputMode="tel"
          />
        </FormField>
      </FormGrid>
    </FormSection>
  );
}
