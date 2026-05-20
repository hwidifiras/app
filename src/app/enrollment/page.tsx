import { EnrollmentWizard } from "@/components/enrollment/enrollment-wizard";
import { PageHeader } from "@/components/ui/page-header";

export default function EnrollmentPage() {
  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Réception"
        title="Inscription"
        description="Inscrire un ou plusieurs élèves, choisir cours et formule, appliquer une offre."
      />
      <EnrollmentWizard />
    </main>
  );
}
