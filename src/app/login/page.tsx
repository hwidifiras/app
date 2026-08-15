import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarCheck2, LockKeyhole, ShieldCheck } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { ClubBrandMark } from "@/components/layout/club-brand-mark";

const reassuranceItems = [
  {
    label: "Pointage du jour",
    detail: "Presences et finalisation au meme endroit.",
    icon: CalendarCheck2,
  },
  {
    label: "Acces protege",
    detail: "Comptes staff, roles et permissions a jour.",
    icon: LockKeyhole,
  },
  {
    label: "Suivi fiable",
    detail: "Paiements, membres et journal d'actions traces.",
    icon: ShieldCheck,
  },
];

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--foreground)]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.04fr)_minmax(29rem,0.96fr)]">
        <section className="relative hidden overflow-hidden bg-[var(--hero-surface)] text-[var(--hero-foreground)] lg:block">
          <Image
            src="/we-discipline/wide-dojo-interior.webp"
            alt=""
            fill
            priority
            sizes="52vw"
            className="object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-[var(--hero-surface)]/60" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--hero-surface)] to-transparent" />

          <div className="relative z-10 flex min-h-screen flex-col justify-between p-8 xl:p-10">
            <Link
              href="/accueil"
              className="inline-flex w-fit items-center gap-3 rounded-lg bg-white/95 px-3 py-2 shadow-[var(--shadow-panel)] [--foreground:#0b1220] [--muted-foreground:#64748b] [--surface-soft:#f8fafc]"
              aria-label="Accueil du produit"
            >
              <ClubBrandMark size="md" />
            </Link>

            <div className="max-w-xl pb-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
                <BadgeCheck className="size-3.5" />
                Interface SaaS pour clubs et dojos
              </div>
              <h1 className="mt-5 text-4xl font-bold leading-tight tracking-normal xl:text-5xl">
                Une reception claire pour piloter la journee.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-slate-200">
                Connectez-vous pour gerer les presences, les paiements, les inscriptions et les priorites du club.
              </p>

              <div className="mt-7 grid gap-3">
                {reassuranceItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/10 p-3">
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]">
                        <Icon className="size-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-white">{item.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-[var(--hero-muted)]">{item.detail}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center px-4 py-6 sm:px-6 lg:px-10">
          <div className="mx-auto flex w-full max-w-[28rem] flex-col">
            <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
              <Link href="/accueil" aria-label="Accueil du produit" className="rounded-lg p-1 hover:bg-[var(--surface-soft)]">
                <ClubBrandMark size="md" />
              </Link>
              <Link
                href="/accueil"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--primary)] shadow-[var(--shadow-panel)]"
              >
                Site
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-floating)] sm:p-6 lg:p-7">
              <div className="mb-6">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                  Acces staff
                </p>
                <h2 className="mt-2 text-2xl font-bold leading-tight text-[var(--foreground)] sm:text-3xl">
                  Connexion
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  Retrouvez votre espace de travail quotidien en quelques secondes.
                </p>
              </div>

              <Suspense fallback={<p className="text-sm text-[var(--muted-foreground)]">Chargement...</p>}>
                <LoginForm />
              </Suspense>
            </div>

            <p className="mt-4 text-center text-xs leading-5 text-[var(--muted-foreground)]">
              Acces reserve aux equipes autorisees. Les activites sensibles sont journalisees.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
