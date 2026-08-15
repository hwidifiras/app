import Link from "next/link";
import { BookOpen, Dumbbell, Layers3, UserPlus } from "lucide-react";

import { EnrollmentWizard } from "@/components/enrollment/enrollment-wizard";
import { SubscriptionAddForm } from "@/components/subscriptions/subscription-add-form";
import { PageHeader } from "@/components/ui/page-header";
import { getClubSettings } from "@/lib/club-settings";
import { hasPermission } from "@/lib/permission-definitions";
import { getAuthUser } from "@/lib/request-user";
import { loadEnrollmentContext, resolveEnrollmentType } from "@/modules/sales/enrollment-context";
import { getTenantProductContext } from "@/platform/product/product-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string; offerId?: string; step?: string; type?: string }>;
}) {
  const { memberId, offerId, step, type } = await searchParams;
  const user = await getAuthUser();
  const settings = await getClubSettings();
  const product = user ? await getTenantProductContext(user.tenantId) : null;
  const gymModuleEnabled = product?.capabilities.gymAccess ?? false;
  const classModuleEnabled = product?.capabilities.classManagement ?? false;
  const selectedType = product ? resolveEnrollmentType(product, type) : "class";
  const initialStep = step === "2" || step === "3" ? Number(step) : 1;
  const canManageMembers = user?.role === "ADMIN" || hasPermission(user?.permissions, "members.manage");
  const canManagePlans = user?.role === "ADMIN" || hasPermission(user?.permissions, "plans.manage");

  const accessContext = user && product && selectedType !== "class"
    ? await loadEnrollmentContext({ tenantId: user.tenantId, type: selectedType, product })
    : null;

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Ventes"
        title="Inscrire"
        description={selectedType === "class" ? "Créer le dossier, choisir le cours, appliquer une offre et préparer l'encaissement." : selectedType === "gym" ? "Ouvrir un pass salle avec un seul prix et un seul solde." : "Vendre les cours et l'accès salle dans un abonnement unique."}
        actions={selectedType !== "class" && canManageMembers ? <Link href="/members/new" className="btn btn-ghost"><UserPlus className="size-4" /> Nouveau membre</Link> : undefined}
      />

      {gymModuleEnabled && classModuleEnabled ? (
        <nav className="mb-5 grid gap-2 sm:grid-cols-3" aria-label="Type d'inscription">
          <Link href="/enrollment?type=class" className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold ${selectedType === "class" ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)]"}`}><BookOpen className="size-4" /> Cours</Link>
          <Link href="/enrollment?type=gym" className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold ${selectedType === "gym" ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)]"}`}><Dumbbell className="size-4" /> Salle</Link>
          <Link href="/enrollment?type=mixed" className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold ${selectedType === "mixed" ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)]"}`}><Layers3 className="size-4" /> Pack mixte</Link>
        </nav>
      ) : null}

      {selectedType === "class" ? (
        <EnrollmentWizard initialMemberId={memberId ?? ""} initialOfferId={offerId ?? ""} initialStep={initialStep} receiptPrintDefault={settings.receiptPrintDefault} />
      ) : accessContext ? (
        accessContext.plans.length > 0 ? (
          <SubscriptionAddForm membersOptions={accessContext.members} plansOptions={accessContext.plans} groupsOptions={accessContext.groups.map((group) => ({ id: group.id, name: group.name, sportId: group.sportId, sportName: group.sport.name }))} initialMemberId={memberId ?? ""} initialPlanKind={selectedType === "gym" ? "GYM" : "MIXED"} receiptPrintDefault={settings.receiptPrintDefault} />
        ) : (
          <section className="panel panel-soft p-6 text-center"><h2 className="font-semibold">Aucune formule disponible</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Demandez à un responsable de créer une formule {selectedType === "gym" ? "Accès salle" : "Pack mixte"}.</p>{canManagePlans ? <Link href="/subscription-plans/new" className="btn btn-primary mt-4">Créer une formule</Link> : null}</section>
        )
      ) : null}
    </main>
  );
}
