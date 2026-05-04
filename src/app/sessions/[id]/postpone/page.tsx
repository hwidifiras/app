import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { PostponeForm } from "@/components/sessions/postpone-form";

export default async function PostponeSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      group: { select: { name: true } },
      coach: { select: { firstName: true, lastName: true } },
    },
  });

  if (!session) {
    notFound();
  }

  const initialDateTime = new Date(session.sessionDate);
  const [hours, minutes] = session.startTime.split(":").map((value) => Number(value));
  initialDateTime.setHours(hours, minutes, 0, 0);

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/attendance/today"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Retour au pointage
      </Link>

      <PageHeader
        overline="Séances"
        title="Reporter une séance"
        description="Déplacez la séance à une nouvelle date et heure (exception unique)."
      />

      <section className="panel panel-soft p-4 md:p-6 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <CalendarClock className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{session.group.name}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {new Date(session.sessionDate).toLocaleDateString("fr-FR")} — {session.startTime} à {session.endTime}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Coach: {session.coach ? `${session.coach.firstName} ${session.coach.lastName}` : "—"}
            </p>
          </div>
        </div>
      </section>

      <PostponeForm sessionId={session.id} initialDateTime={initialDateTime.toISOString()} />
    </main>
  );
}
