import { OffersManager } from "@/components/offers/offers-manager";
import { PageHeader } from "@/components/ui/page-header";

export default function OffersPage() {
  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Réception"
        title="Offres promotionnelles"
        description="Réductions famille, 2e discipline, ou offre rapide en %."
      />
      <OffersManager />
    </main>
  );
}
