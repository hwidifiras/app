import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarCheck2, LockKeyhole, ShieldCheck } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";

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
    <main className="min-h-screen bg-[#F6F9FF] text-[#0B1220]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.04fr)_minmax(29rem,0.96fr)]">
        <section className="relative hidden overflow-hidden bg-[#0B1220] text-white lg:block">
          <Image
            src="/we-discipline/wide-dojo-interior.png"
            alt=""
            fill
            priority
            sizes="52vw"
            className="object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-[#0B1220]/60" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0B1220] to-transparent" />

          <div className="relative z-10 flex min-h-screen flex-col justify-between p-8 xl:p-10">
            <Link href="/accueil" className="inline-flex w-fit items-center gap-3" aria-label="Accueil We Discipline">
              <Image
                src="/we-discipline/navbar-logo.png"
                alt=""
                width={158}
                height={48}
                className="h-12 w-auto"
                priority
              />
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
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#2563EB] text-white">
                        <Icon className="size-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-white">{item.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-300">{item.detail}</span>
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
              <Link href="/accueil" aria-label="Accueil We Discipline" className="relative block h-11 w-[138px]">
                <Image src="/we-discipline/navbar-logo.png" alt="" fill sizes="138px" className="object-contain" />
              </Link>
              <Link
                href="/accueil"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#D8E2F0] bg-white px-3 text-xs font-semibold text-[#2563EB] shadow-[0_6px_16px_rgba(15,23,42,0.05)]"
              >
                Site
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <div className="rounded-lg border border-[#D8E2F0] bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.10)] sm:p-6 lg:p-7">
              <div className="mb-6">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#2563EB]">
                  Acces staff
                </p>
                <h2 className="mt-2 text-2xl font-bold leading-tight text-[#0B1220] sm:text-3xl">
                  Connexion
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#64748B]">
                  Retrouvez votre espace de travail quotidien en quelques secondes.
                </p>
              </div>

              <Suspense fallback={<p className="text-sm text-[#64748B]">Chargement...</p>}>
                <LoginForm />
              </Suspense>
            </div>

            <p className="mt-4 text-center text-xs leading-5 text-[#64748B]">
              Acces reserve aux equipes autorisees. Les activites sensibles sont journalisees.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
