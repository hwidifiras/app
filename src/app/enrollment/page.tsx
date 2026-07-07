import { EnrollmentWizard } from "@/components/enrollment/enrollment-wizard";
import { PageHeader } from "@/components/ui/page-header";
import { getClubSettings } from "@/lib/club-settings";

export default async function EnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string; offerId?: string; step?: string }>;
}) {
  const { memberId, offerId, step } = await searchParams;
  const initialStep = step === "2" || step === "3" ? Number(step) : 1;
  const settings = await getClubSettings();

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Ventes"
        title="Inscrire"
        description="Créer le dossier, choisir le cours, appliquer une offre et préparer l'encaissement."
      />
      <EnrollmentWizard
        initialMemberId={memberId ?? ""}
        initialOfferId={offerId ?? ""}
        initialStep={initialStep}
        receiptPrintDefault={settings.receiptPrintDefault}
      />
    </main>
  );
}
