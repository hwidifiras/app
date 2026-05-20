import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { GroupEditForm } from "@/components/groups/group-edit-form";
import { PageHeader } from "@/components/ui/page-header";

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
      include: { sport: { select: { name: true } } },
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

  const coachesOptions = coaches.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    email: c.email,
    isActive: c.isActive,
    sportId: c.sportId,
    sportName: c.sport?.name ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

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
        overline="Référentiels"
        title="Modifier le groupe"
        description={group.name}
      />

      <section className="panel panel-soft p-6">
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
