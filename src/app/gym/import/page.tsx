import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { GymImportPreview } from "@/components/gym/gym-import-preview";
import { PageHeader } from "@/components/ui/page-header";
import { userHasPermission } from "@/lib/permissions";
import { getAuthUser } from "@/lib/request-user";
import { isTenantModuleEnabled } from "@/lib/tenant-modules";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GymImportPage() {
  const user = await getAuthUser();
  const enabled = user ? await isTenantModuleEnabled(user.tenantId, "GYM_ACCESS") : false;
  const permitted = user ? await userHasPermission(user, "gym.manage") : false;
  if (!user || !enabled || !permitted) {
    return <main className="app-shell py-4 md:py-8"><PageHeader overline="Accès salle" title="Import salle" description="Ce module n'est pas actif ou votre compte n'y a pas accès." /><section className="panel panel-soft p-5 text-sm text-[var(--muted-foreground)]">Accès indisponible.</section></main>;
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <Link href="/gym/visits" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"><ArrowLeft className="size-4" /> Retour au suivi salle</Link>
      <PageHeader overline="Reprise" title="Vérifier un ancien fichier salle" description="Contrôlez les membres, les formules et les paiements avant toute reprise réelle." />
      <GymImportPreview />
    </main>
  );
}
