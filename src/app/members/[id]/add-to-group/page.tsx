import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { AddMemberToGroupForm } from "@/components/members/add-member-to-group-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AddMemberToGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const member = await prisma.member.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      memberType: true,
      status: true,
      subscriptions: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          amount: true,
          remainingSessions: true,
          plan: {
            select: {
              id: true,
              name: true,
              sportId: true,
              sport: { select: { name: true } },
              totalSessions: true,
            },
          },
          payments: { select: { amount: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      groups: {
        where: { status: "ACTIVE" },
        select: { groupId: true },
      },
    },
  });

  if (!member) {
    notFound();
  }

  if (member.status !== "ACTIVE") {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Action indisponible
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            Impossible d&apos;ajouter un membre résilié
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Ce membre a un statut RÉSILIÉ et ne peut pas être ajouté à un groupe.
          </p>
          <div className="mt-4">
            <Link href={`/members/${id}`} className="btn btn-ghost">
              Retour à la fiche
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const groups = await prisma.group.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      sportId: true,
      sport: { select: { name: true } },
      coach: { select: { firstName: true, lastName: true } },
      room: true,
      capacity: true,
      groupType: true,
      _count: {
        select: {
          members: { where: { status: "ACTIVE" } },
        },
      },
      schedules: {
        orderBy: { createdAt: "asc" },
        select: {
          dayOfWeek: true,
          startTime: true,
          durationMinutes: true,
        },
      },
    },
  });

  // Filtre les groupes déjà assignés
  const availableGroups = groups.filter(
    (g) => !member.groups.some((mg) => mg.groupId === g.id)
  );

  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sportId: true,
      sport: { select: { name: true } },
      price: true,
      totalSessions: true,
      validityDays: true,
    },
  });

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href={`/members/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Retour à la fiche
      </Link>

      <PageHeader
        overline="Gestion du membre"
        title="Affecter à un groupe"
        description={`${member.firstName} ${member.lastName} · sélectionnez un groupe et l'abonnement associé.`}
      />

      <section className="panel p-4 sm:p-6">
        <AddMemberToGroupForm
          memberId={id}
          memberName={`${member.firstName} ${member.lastName}`}
          memberType={member.memberType}
          plans={plans.map((plan) => ({
            id: plan.id,
            planName: plan.name,
            sportId: plan.sportId,
            sportName: plan.sport?.name ?? "Tous les sports",
            price: plan.price,
            totalSessions: plan.totalSessions,
            validityDays: plan.validityDays,
          }))}
          availableGroups={availableGroups.map((g) => ({
            id: g.id,
            name: g.name,
            sportId: g.sportId,
            sportName: g.sport.name,
            coachName: `${g.coach.firstName} ${g.coach.lastName}`,
            room: g.room,
            capacity: g.capacity,
            activeMembers: g._count.members,
            groupType: g.groupType,
            schedules: g.schedules,
          }))}
        />
      </section>
    </main>
  );
}
