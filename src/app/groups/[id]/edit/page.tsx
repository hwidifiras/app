import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { GroupEditForm } from "@/components/groups/group-edit-form";
import { PageHeader } from "@/components/ui/page-header";
import type { CoachDto } from "@/types/coach";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      sport: { select: { name: true } },
      coach: { select: { firstName: true, lastName: true } },
      members: {
        where: { status: "ACTIVE" },
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

  const sportsOptions = sports.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  const coachesOptions: CoachDto[] = coaches.map((c) => {
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

  const membersOptions = members.map((m) => ({
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
        overline="Configuration"
        title="Modifier le cours"
        description={group.name}
      />

      <section className="panel p-4 sm:p-6">
        <GroupEditForm
          groupId={group.id}
          initialData={{
            name: group.name,
            groupType: group.groupType,
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
      </section>
    </main>
  );
}
