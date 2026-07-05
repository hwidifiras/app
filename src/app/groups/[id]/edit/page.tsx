import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { GroupEditForm } from "@/components/groups/group-edit-form";
import { PageHeader } from "@/components/ui/page-header";
import { buildCoachDto } from "@/lib/coach-view-model";
import { getAuthUser } from "@/lib/request-user";
import type { CoachDto } from "@/types/coach";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getAuthUser();

  if (!authUser) {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Club"
          title="Modifier le cours"
          description="Connectez-vous pour modifier un groupe."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  const group = await prisma.group.findFirst({
    where: { id, tenantId: authUser.tenantId },
    include: {
      sport: { select: { name: true } },
      coach: { select: { firstName: true, lastName: true } },
      members: {
        where: { tenantId: authUser.tenantId, status: "ACTIVE" },
        include: {
          member: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
      },
    },
  });

  if (!group) {
    notFound();
  }

  const [sports, coaches, members] = await Promise.all([
    prisma.sport.findMany({ where: { tenantId: authUser.tenantId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.coach.findMany({
      where: { tenantId: authUser.tenantId, isActive: true },
      include: {
        sport: { select: { id: true, name: true } },
        qualifications: {
          where: { tenantId: authUser.tenantId },
          include: { sport: { select: { id: true, name: true } } },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.member.findMany({
      where: { tenantId: authUser.tenantId, status: "ACTIVE" },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  const sportsOptions = sports.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  const coachesOptions: CoachDto[] = coaches.map(buildCoachDto);

  const membersOptions = members.map((m) => ({
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    phone: m.phone,
    email: m.email,
    memberType: m.memberType,
    gender: m.gender,
    birthDate: m.birthDate?.toISOString() ?? null,
    address: m.address ?? null,
    parentName: m.parentName ?? null,
    parentPhone: m.parentPhone ?? null,
    parentAddress: m.parentAddress ?? null,
    status: m.status,
    paymentStatus: "UNPAID", // Placeholder pour l'UI, ce champ est géré via API
    joinedAt: m.joinedAt.toISOString(),
    archivedAt: m.archivedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    groupIds: [], // Placeholder
  }));

  const initialMemberIds = group.members.map((gm) => gm.memberId);

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/groups"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Retour à la liste
      </Link>

      <PageHeader
        overline="Club"
        title="Modifier le cours"
        description={group.name}
      />

      <GroupEditForm
        groupId={group.id}
        initialData={{
          name: group.name,
          groupType: group.groupType,
          genderPolicy: group.genderPolicy,
          sportId: group.sportId,
          coachId: group.coachId,
          capacity: group.capacity,
          room: group.room,
          isActive: group.isActive,
        }}
        sportsOptions={sportsOptions}
        coachesOptions={coachesOptions}
        membersOptions={membersOptions}
        initialMemberIds={initialMemberIds}
      />
    </main>
  );
}
