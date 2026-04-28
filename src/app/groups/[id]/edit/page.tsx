import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GroupEditForm } from "@/components/groups/group-edit-form";

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
    status: m.status,
    joinedAt: m.joinedAt.toISOString(),
    archivedAt: m.archivedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }));

  const initialMemberIds = group.members.map((gm) => gm.memberId);

  return (
    <main className="app-shell py-4 md:py-8">
      <div className="mb-5 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Parcours réception</p>
        <h1 className="text-2xl font-semibold text-[var(--foreground)] md:text-3xl">Modifier le groupe</h1>
        <p className="text-sm text-[var(--foreground)] font-medium">{group.name}</p>
      </div>

      <section className="panel panel-soft p-6">
        <GroupEditForm
          groupId={group.id}
          initialData={{
            name: group.name,
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

      <div className="mt-4">
        <Link href="/groups" className="text-sm font-medium text-[var(--primary)] underline">
          ← Retour à la liste des groupes
        </Link>
      </div>
    </main>
  );
}
