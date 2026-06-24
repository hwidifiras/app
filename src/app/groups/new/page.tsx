import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { GroupAddForm } from "@/components/groups/group-add-form";
import { PageHeader } from "@/components/ui/page-header";
import type { CoachDto } from "@/types/coach";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewGroupPage() {
  let hasError = false;
  let sportsOptions: Array<{ id: string; name: string; description: string | null; isActive: boolean; createdAt: string; updatedAt: string }> = [];
  let coachesOptions: CoachDto[] = [];
  let membersOptions: Array<{ id: string; firstName: string; lastName: string; phone: string; email: string | null; memberType: "ADULT" | "KID" | "NOT_SPECIFIED"; status: "ACTIVE" | "ARCHIVED"; birthDate: string | null; address: string | null; parentName: string | null; parentPhone: string | null; parentAddress: string | null; paymentStatus: string; joinedAt: string; archivedAt: string | null; createdAt: string; updatedAt: string; groupIds: string[]; }> = [];

  try {
    const [sports, coaches, members] = await Promise.all([
      prisma.sport.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.coach.findMany({
        where: { isActive: true },
        include: {
          sport: { select: { id: true, name: true } },
          qualifications: {
            include: { sport: { select: { id: true, name: true } } },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
      prisma.member.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
    ]);

    sportsOptions = sports.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() }));
    coachesOptions = coaches.map((c) => {
      const qualifiedSportsById = new Map<string, { id: string; name: string; isPrimary: boolean }>();
      for (const qualification of c.qualifications) {
        qualifiedSportsById.set(qualification.sport.id, {
          id: qualification.sport.id,
          name: qualification.sport.name,
          isPrimary: qualification.isPrimary,
        });
      }
      if (c.sport) {
        qualifiedSportsById.set(c.sport.id, {
          id: c.sport.id,
          name: c.sport.name,
          isPrimary: true,
        });
      }
      const qualifiedSports = Array.from(qualifiedSportsById.values()).sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return a.name.localeCompare(b.name, "fr");
      });

      return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        isActive: c.isActive,
        sportId: c.sportId,
        sportName: c.sport?.name ?? null,
        qualifiedSportIds: qualifiedSports.map((sport) => sport.id),
        qualifiedSports,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    });
    membersOptions = members.map((m) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      phone: m.phone,
      email: m.email,
      memberType: m.memberType,
      birthDate: m.birthDate?.toISOString() ?? null,
      address: m.address ?? null,
      parentName: m.parentName ?? null,
      parentPhone: m.parentPhone ?? null,
      parentAddress: m.parentAddress ?? null,
      status: m.status,
      paymentStatus: "UNPAID",
      joinedAt: m.joinedAt.toISOString(),
      archivedAt: m.archivedAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      groupIds: [],
    }));
  } catch {
    hasError = true;
  }

  if (hasError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Création de groupe indisponible</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Données inaccessibles. Lancez `npm run prisma:generate` puis redémarrez le serveur.
          </p>
          <div className="mt-4">
            <Link href="/groups" className="btn btn-ghost">Retour aux groupes</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/groups"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Retour à la liste
      </Link>

      <PageHeader
        overline="Configuration"
        title="Nouveau cours"
        description="Créer le groupe, puis planifier ses créneaux."
      />

      <GroupAddForm sportsOptions={sportsOptions} coachesOptions={coachesOptions} membersOptions={membersOptions} />
    </main>
  );
}
