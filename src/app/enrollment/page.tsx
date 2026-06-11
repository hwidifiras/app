import { EnrollmentWizard } from "@/components/enrollment/enrollment-wizard";
import { PageHeader } from "@/components/ui/page-header";

export default async function EnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string; offerId?: string; step?: string }>;
}) {
  const { memberId, offerId, step } = await searchParams;
  const initialStep = step === "2" || step === "3" ? Number(step) : 1;

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Réception"
        title="Inscription"
        description="Inscrire un ou plusieurs élèves, choisir cours et formule, appliquer une offre."
      />
      <EnrollmentWizard
        initialMemberId={memberId ?? ""}
        initialOfferId={offerId ?? ""}
        initialStep={initialStep}
      />
    </main>
  );
}
