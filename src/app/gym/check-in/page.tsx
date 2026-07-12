import Link from "next/link";
import { History } from "lucide-react";

import { GymCheckInPanel } from "@/components/gym/gym-check-in-panel";
import { PageHeader } from "@/components/ui/page-header";
import { userHasPermission } from "@/lib/permissions";
import { getAuthUser } from "@/lib/request-user";
import { isTenantModuleEnabled } from "@/lib/tenant-modules";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GymCheckInPage() {
  const user = await getAuthUser();
  const enabled = user ? await isTenantModuleEnabled(user.tenantId, "GYM") : false;
  const permitted = user ? await userHasPermission(user, "gym.checkin") : false;
  const canManageVisits = user ? await userHasPermission(user, "gym.manage") : false;

  if (!user || !enabled || !permitted) {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader overline="Aujourd'hui" title="Accès salle" description="Ce module n'est pas actif ou votre compte n'y a pas accès." />
        <section className="panel panel-soft p-5 text-sm text-[var(--muted-foreground)]">Accès indisponible.</section>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Aujourd'hui"
        title="Accès salle"
        description="Vérifiez le pass et enregistrez l'entrée du membre."
        actions={canManageVisits ? <Link href="/gym/visits" className="btn btn-ghost"><History className="size-4" /> Historique</Link> : undefined}
      />
      <GymCheckInPanel />
    </main>
  );
}
