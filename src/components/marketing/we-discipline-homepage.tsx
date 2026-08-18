import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  AppWindow,
  BellRing,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  Mail,
  MessageCircleWarning,
  MonitorSmartphone,
  MonitorPlay,
  ReceiptText,
  UserCog,
  UserPlus,
} from "lucide-react";

import { AccessMediaCarousel } from "@/components/marketing/access-media-carousel";
import { MarketingHeader } from "@/components/marketing/marketing-header";

type HomepageProps = {
  fontClassName: string;
};

const workflows = [
  {
    title: "Inscriptions sans double saisie",
    description: "Créez le membre, choisissez sa formule, affectez son groupe et enregistrez le premier paiement dans un seul parcours.",
    icon: UserPlus,
    tag: "Inscription",
    details: ["Dossiers adultes et enfants", "Responsable légal", "Formules et remises"],
  },
  {
    title: "Pointage clair à chaque séance",
    description: "Le bureau et les coachs voient les élèves attendus, les absents, les passages exceptionnels et les séances à finaliser.",
    icon: ClipboardCheck,
    tag: "Présences",
    details: ["Liste par séance", "Règles d'accès visibles", "Historique conservé"],
  },
  {
    title: "Paiements et reçus traçables",
    description: "Encaissez un total ou un acompte, suivez le reste à payer et remettez un reçu vérifiable sans refaire les calculs.",
    icon: ReceiptText,
    tag: "Caisse",
    details: ["Paiements partiels", "Reçus imprimables", "Corrections avec motif"],
  },
  {
    title: "Planning pensé pour les clubs",
    description: "Organisez disciplines, groupes, coachs, salles et créneaux dans un planning hebdomadaire lisible sur ordinateur et mobile.",
    icon: CalendarDays,
    tag: "Planning",
    details: ["Séances automatiques", "Conflits signalés", "Actions par séance"],
  },
];

const dashboardSignals = [
  { label: "Séances aujourd'hui", value: "4", icon: CalendarDays },
  { label: "À encaisser", value: "6", icon: CircleDollarSign },
  { label: "À finaliser", value: "2", icon: ClipboardCheck },
  { label: "Alertes utiles", value: "3", icon: BellRing },
];

const ownerBenefits = [
  {
    title: "Une caisse lisible",
    description: "Encaissements du jour, reste à payer, reçus et historique financier restent accessibles sans feuille parallèle.",
    icon: CreditCard,
  },
  {
    title: "Les priorités au même endroit",
    description: "Le dashboard remonte les impayés, renouvellements, séances à pointer et actions qui demandent réellement une décision.",
    icon: MessageCircleWarning,
  },
  {
    title: "Des chiffres compréhensibles",
    description: "Présences, membres actifs, encaissements et activité des groupes se lisent sans construire un rapport manuellement.",
    icon: LayoutDashboard,
  },
];

const coachCapabilities = [
  "Voir uniquement les groupes et séances autorisés",
  "Pointer les élèves depuis un téléphone",
  "Consulter le planning utile à son travail",
  "Éviter l'accès aux réglages et données financières sensibles",
];

const plans = [
  {
    name: "Essentiel",
    audience: "Pour centraliser l'accueil du club",
    description: "Les outils indispensables pour remplacer les cahiers, les fichiers dispersés et les calculs manuels.",
    features: ["Membres et inscriptions", "Formules et abonnements", "Pointage des séances", "Paiements et reçus", "Planning des groupes"],
  },
  {
    name: "Club",
    audience: "Pour piloter l'activité au quotidien",
    description: "Une organisation plus complète pour la réception, la caisse, les relances et le suivi des cours.",
    features: ["Tout l'Essentiel", "Comptes coachs", "Rôles et permissions", "Alertes et renouvellements", "Rapports de suivi"],
    highlighted: true,
  },
  {
    name: "Académie",
    audience: "Pour déléguer à une équipe structurée",
    description: "Des accès plus fins, un accompagnement de reprise et une configuration adaptée aux clubs plus organisés.",
    features: ["Tout le plan Club", "Plusieurs comptes équipe", "Import des données existantes", "Configuration accompagnée", "Support prioritaire"],
  },
];

const faqs = [
  {
    question: "Est-ce adapté à un petit club ?",
    answer: "Oui. Le parcours quotidien reste volontairement simple : inscrire, encaisser, pointer et consulter le planning. Les réglages avancés restent séparés.",
  },
  {
    question: "Puis-je reprendre mes membres existants ?",
    answer: "Oui. Les membres peuvent être saisis progressivement ou importés avec un fichier préparé, puis vérifiés avant l'ouverture du compte à l'équipe.",
  },
  {
    question: "Les coachs voient-ils les paiements ?",
    answer: "Pas par défaut. Leurs comptes peuvent être limités aux groupes, séances et actions de pointage autorisés par l'administrateur du club.",
  },
  {
    question: "Le matériel RFID est-il obligatoire ?",
    answer: "Non. Le club peut commencer immédiatement avec le pointage manuel. Les supports QR ou RFID sont des options à configurer selon le parcours et le matériel retenus.",
  },
];

function SectionHeading({ eyebrow, title, description, center = false }: { eyebrow: string; title: string; description: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">{description}</p>
    </div>
  );
}

function DemoLink({ className = "" }: { className?: string }) {
  return (
    <Link href="/demo" className={`inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 ${className}`}>
      <MonitorPlay className="size-5" aria-hidden="true" />
      Explorer la démo
    </Link>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-[620px] overflow-hidden bg-slate-950 text-white">
      <Image src="/we-discipline/wide-dojo-interior.webp" alt="Cours d'arts martiaux dans un dojo moderne" fill priority sizes="100vw" className="object-cover object-center" />
      <div className="absolute inset-0 bg-slate-950/75" aria-hidden="true" />
      <div className="absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,rgba(7,15,29,0.98)_0%,rgba(7,15,29,0.82)_48%,rgba(7,15,29,0.28)_100%)]" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-[620px] max-w-7xl items-center px-5 py-16 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-sky-300">We Discipline · Gestion de club</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.05] sm:text-5xl lg:text-6xl">Logiciel de gestion pour clubs d&apos;arts martiaux</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-200 sm:text-xl">Inscriptions, présences, paiements, reçus, groupes, planning et comptes coachs réunis dans un espace clair pour votre équipe.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <DemoLink />
            <a href="mailto:contact@we-discipline.com?subject=Demande%20de%20présentation" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/35 bg-white/10 px-5 text-sm font-bold text-white transition-colors hover:bg-white/15">
              Demander une présentation
              <Mail className="size-4" aria-hidden="true" />
            </a>
          </div>
          <div className="mt-9 grid max-w-2xl gap-3 text-sm font-semibold text-slate-200 sm:grid-cols-3">
            {["Conçu pour le quotidien du club", "Montants et reçus en TND", "Accès équipe contrôlés"].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductProofSection() {
  return (
    <section id="fonctionnalites" className="bg-[#F6F9FF] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading eyebrow="Le club aujourd'hui" title="Le travail important apparaît avant les tableaux compliqués." description="Le tableau de bord montre d'abord ce qu'il faut faire : les séances du jour, la caisse, les paiements à suivre et les actions à finaliser." />

        <div className="mt-10 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
          <Image src="/we-discipline/hero-dashboard-reception.webp" alt="Dashboard We Discipline avec séances, caisse et priorités" width={1536} height={1024} sizes="(min-width: 1280px) 1216px, 100vw" className="h-auto w-full object-cover" />
        </div>

        <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {dashboardSignals.map((signal) => {
            const Icon = signal.icon;
            return (
              <div key={signal.label} className="flex items-center gap-4 bg-white p-5">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icon className="size-5" aria-hidden="true" /></span>
                <div>
                  <p className="text-2xl font-black text-slate-950">{signal.value}</p>
                  <p className="text-sm font-semibold text-slate-500">{signal.label}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">Aperçu utilisant des données de démonstration.</p>
      </div>
    </section>
  );
}

function AvailabilitySection() {
  const upcomingPlatforms = [
    { name: "App Store", detail: "Application iPhone et iPad" },
    { name: "Google Play", detail: "Application Android" },
  ];

  return (
    <section id="disponibilite" className="border-y border-slate-200 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_0.9fr]">
          <SectionHeading
            eyebrow="Disponible dès maintenant"
            title="Le club vous suit déjà sur ordinateur, tablette et mobile."
            description="We Discipline fonctionne aujourd'hui dans le navigateur, sans installation. L'interface s'adapte au bureau de la réception comme au téléphone du coach."
          />
          <div className="flex lg:justify-end">
            <DemoLink className="w-full sm:w-auto" />
          </div>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          <article className="rounded-lg border-2 border-blue-600 bg-blue-50 p-6">
            <div className="flex items-start justify-between gap-4">
              <span className="inline-flex size-11 items-center justify-center rounded-lg bg-blue-600 text-white">
                <MonitorSmartphone className="size-5" aria-hidden="true" />
              </span>
              <span className="rounded-md bg-emerald-100 px-2.5 py-1.5 text-xs font-black text-emerald-800">Disponible</span>
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.14em] text-blue-700">Application web</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">Prête à utiliser aujourd&apos;hui</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">Accédez au même espace sécurisé depuis Chrome, Safari ou Edge, sur ordinateur, tablette et téléphone.</p>
          </article>

          {upcomingPlatforms.map((platform) => (
            <article key={platform.name} className="rounded-lg border border-slate-200 bg-slate-50 p-6">
              <div className="flex items-start justify-between gap-4">
                <span className="inline-flex size-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                  <AppWindow className="size-5" aria-hidden="true" />
                </span>
                <span className="rounded-md bg-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700">Bientôt</span>
              </div>
              <p className="mt-6 text-xs font-black uppercase tracking-[0.14em] text-slate-500">{platform.name}</p>
              <h3 className="mt-2 text-xl font-black text-slate-950">{platform.detail}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">En préparation. La version web mobile reste disponible entre-temps, sans attendre une publication en boutique.</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading eyebrow="Du bureau au tatami" title="Quatre parcours simples pour faire tourner le club." description="Chaque écran part d'une action réelle de la réception ou du coach, sans obliger l'utilisateur à comprendre la structure technique du logiciel." center />

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {workflows.map((workflow) => {
            const Icon = workflow.icon;
            return (
              <article key={workflow.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white"><Icon className="size-5" aria-hidden="true" /></span>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600">{workflow.tag}</span>
                </div>
                <h3 className="mt-6 text-xl font-black text-slate-950">{workflow.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{workflow.description}</p>
                <ul className="mt-5 grid gap-2.5 text-sm font-semibold text-slate-700 sm:grid-cols-3">
                  {workflow.details.map((detail) => (
                    <li key={detail} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />{detail}</li>
                  ))}
                </ul>
                <Link href="/demo" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800">Voir dans la démo<ArrowRight className="size-4" aria-hidden="true" /></Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function OwnerSection() {
  return (
    <section className="bg-slate-950 py-20 text-white sm:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-300">Pilotage du club</p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Savoir quoi encaisser, relancer et organiser.</h2>
            <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">We Discipline transforme les données du quotidien en décisions concrètes, sans transformer le responsable du club en comptable ou analyste.</p>
          </div>
          <div className="grid gap-5">
            {ownerBenefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <article key={benefit.title} className="grid gap-4 border-b border-white/10 pb-6 sm:grid-cols-[48px_1fr]">
                  <span className="inline-flex size-12 items-center justify-center rounded-lg bg-blue-600 text-white"><Icon className="size-5" aria-hidden="true" /></span>
                  <div><h3 className="text-lg font-black">{benefit.title}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{benefit.description}</p></div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function CoachSection() {
  return (
    <section id="coachs" className="bg-white py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-2 lg:px-8">
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
          <Image src="/we-discipline/coach-helping-child.webp" alt="Coach accompagnant un jeune élève pendant un cours" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        </div>
        <div>
          <SectionHeading eyebrow="Comptes coachs" title="Le coach voit son travail, pas toute l'administration." description="Chaque membre de l'équipe reçoit un accès adapté à son rôle. La réception garde la caisse et les dossiers sensibles, tandis que le coach retrouve ses groupes et ses séances." />
          <ul className="mt-8 grid gap-4">
            {coachCapabilities.map((capability) => (
              <li key={capability} className="flex items-start gap-3 text-sm font-semibold text-slate-700">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Check className="size-4" aria-hidden="true" /></span>
                <span className="pt-1">{capability}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950"><UserCog className="size-5 shrink-0 text-blue-600" aria-hidden="true" />Les permissions restent modifiables par l&apos;administrateur du club.</div>
        </div>
      </div>
    </section>
  );
}

function AccessSection() {
  return (
    <section id="pointage" className="bg-[#F6F9FF] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading eyebrow="Accès et identification" title="Un seul pointage, plusieurs façons d'identifier un membre." description="Commencez immédiatement par la recherche du membre. Ajoutez ensuite une carte QR, RFID ou un bracelet lorsque ce choix apporte un vrai gain à l'accueil." />
          <p className="max-w-md text-sm leading-6 text-slate-500">Le QR peut être déployé sans lecteur spécialisé. Les cartes et bracelets RFID sont activés uniquement après validation du matériel du club.</p>
        </div>

        <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-3">
          {[
            ["1", "Recherche manuelle", "Disponible maintenant"],
            ["2", "Carte QR", "Activation accompagnée"],
            ["3", "RFID ou bracelet", "Après validation matérielle"],
          ].map(([step, title, status]) => (
            <li key={title} className="flex items-center gap-4 bg-white p-5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-blue-700">{step}</span>
              <div>
                <p className="text-sm font-black text-slate-950">{title}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{status}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5"><AccessMediaCarousel /></div>
      </div>
    </section>
  );
}

function PlansSection() {
  return (
    <section id="formules" className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading eyebrow="Trois formules" title="Une lecture simple, selon la façon dont votre club travaille." description="Trois choix compréhensibles, avec une base fonctionnelle claire et sans liste interminable de modules. Le tarif dépend de la taille et de l'organisation du club." center />

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.name} className={plan.highlighted ? "relative rounded-lg border-2 border-blue-600 bg-white p-7 shadow-[0_20px_55px_rgba(37,99,235,0.16)]" : "relative rounded-lg border border-slate-200 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.06)]"}>
              {plan.highlighted ? <span className="absolute right-5 top-5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white">Recommandée</span> : null}
              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-600">{plan.name}</p>
              <h3 className="mt-5 pr-24 text-xl font-black text-slate-950">{plan.audience}</h3>
              <p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-600">{plan.description}</p>
              <p className="mt-6 border-y border-slate-200 py-4 text-sm font-bold text-slate-800">Tarif de lancement sur demande</p>
              <ul className="mt-6 grid gap-3 text-sm font-semibold text-slate-700">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />{feature}</li>
                ))}
              </ul>
              <a href={`mailto:contact@we-discipline.com?subject=${encodeURIComponent(`Offre ${plan.name} - We Discipline`)}`} className={plan.highlighted ? "mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700" : "mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-800 hover:border-blue-400 hover:text-blue-700"}>
                Recevoir l&apos;offre {plan.name}<ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="bg-[#F6F9FF] py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-5 lg:px-8">
        <SectionHeading eyebrow="Questions fréquentes" title="Les réponses utiles avant de changer d'outil." description="Le logiciel doit simplifier l'organisation du club dès le départ, sans matériel obligatoire ni configuration opaque." center />
        <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
          {faqs.map((faq) => (
            <details key={faq.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-black text-slate-950">{faq.question}<span className="text-xl font-normal text-blue-600 transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary>
              <p className="max-w-3xl pt-3 text-sm leading-6 text-slate-600">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section id="contact" className="bg-blue-600 py-16 text-white sm:py-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-100">Prêt à voir le produit ?</p>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">Explorez un club de démonstration avant de décider.</h2>
          <p className="mt-4 text-base leading-7 text-blue-100">Les données sont fictives, les parcours sont réalistes et aucun compte client n&apos;est modifié.</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Link href="/demo" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-bold text-blue-700 hover:bg-blue-50"><MonitorPlay className="size-5" aria-hidden="true" />Ouvrir la démo</Link>
          <a href="mailto:contact@we-discipline.com?subject=Demande%20de%20présentation" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/60 bg-blue-700 px-5 text-sm font-bold text-white hover:bg-blue-800"><Mail className="size-4" aria-hidden="true" />Demander une présentation</a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-950 py-12 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr] lg:px-8">
        <div>
          <Link href="/accueil" className="relative block h-16 w-48" aria-label="Accueil We Discipline"><Image src="/we-discipline/footer-logo.webp" alt="We Discipline" fill sizes="192px" className="object-contain object-left" /></Link>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">Une plateforme claire pour gérer les membres, les séances, les présences et la caisse des clubs d&apos;arts martiaux.</p>
        </div>
        <div>
          <p className="text-sm font-black text-white">Produit</p>
          <div className="mt-4 grid gap-3 text-sm"><a href="#fonctionnalites" className="hover:text-white">Fonctionnalités</a><a href="#disponibilite" className="hover:text-white">Web et applications</a><a href="#pointage" className="hover:text-white">Pointage et supports</a><a href="#coachs" className="hover:text-white">Comptes coachs</a><Link href="/demo" className="hover:text-white">Démo interactive</Link></div>
        </div>
        <div>
          <p className="text-sm font-black text-white">Accès</p>
          <div className="mt-4 grid gap-3 text-sm"><a href="mailto:contact@we-discipline.com?subject=Demande%20d%27accès" className="hover:text-white">Demander un accès</a><a href="/login" className="hover:text-white">Connexion</a><a href="mailto:contact@we-discipline.com" className="hover:text-white">Contact</a></div>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-7xl border-t border-white/10 px-5 pt-6 text-xs text-slate-500 lg:px-8">© {new Date().getFullYear()} We Discipline. Tous droits réservés.</div>
    </footer>
  );
}

export function WeDisciplineHomepage({ fontClassName }: HomepageProps) {
  return (
    <div className={`${fontClassName} min-h-screen bg-white text-slate-950`}>
      <MarketingHeader />
      <main>
        <HeroSection />
        <ProductProofSection />
        <AvailabilitySection />
        <WorkflowSection />
        <OwnerSection />
        <CoachSection />
        <AccessSection />
        <PlansSection />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
