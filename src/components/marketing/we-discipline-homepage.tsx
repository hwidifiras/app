"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useInView, type Variants } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Globe2,
  Mail,
  Medal,
  Menu,
  MessageCircle,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type HomepageProps = {
  fontClassName: string;
};

type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type Stat = {
  value: number;
  suffix: string;
  label: string;
  icon: LucideIcon;
};

const assets = {
  coach: "/we-discipline/coach-portrait.png",
  dojo: "/we-discipline/wide-dojo-interior.png",
  mentorship: "/we-discipline/coach-helping-child.png",
  champion: "/we-discipline/champion-silhouette.png",
  texture: "/we-discipline/dojo-texture.png",
};

const navItems = [
  { label: "Fonctionnalités", href: "#fonctionnalites" },
  { label: "Solutions", href: "#solutions" },
  { label: "Tarifs", href: "#tarifs" },
  { label: "À propos", href: "#valeurs" },
];

const footerGroups = [
  {
    title: "Navigation",
    links: [
      { label: "Fonctionnalités", href: "#fonctionnalites" },
      { label: "Solutions", href: "#solutions" },
      { label: "Tarifs", href: "#tarifs" },
      { label: "À propos", href: "#valeurs" },
    ],
  },
  {
    title: "Produit",
    links: [
      { label: "Tableau de bord", href: "#tableau-de-bord" },
      { label: "Progression", href: "#progression" },
      { label: "Communauté", href: "#demo" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Contact",
    links: [
      { label: "Réserver une démo", href: "#demo" },
      { label: "Démarrer l'essai", href: "#tarifs" },
      { label: "Nous écrire", href: "mailto:contact@wediscipline.com" },
      { label: "Connexion", href: "/login" },
    ],
  },
];

const trustItems = ["Sans carte bancaire", "Configuration en quelques minutes", "Annulation à tout moment"];

const beltJourney = [
  { name: "Ceinture blanche", image: "/we-discipline/white-belt.png", color: "#F8FAFC", count: "28 élèves" },
  { name: "Ceinture jaune", image: "/we-discipline/yellow-belt.png", color: "#FACC15", count: "34 élèves" },
  { name: "Ceinture orange", image: "/we-discipline/orange-belt.png", color: "#FB923C", count: "26 élèves" },
  { name: "Ceinture verte", image: "/we-discipline/green-belt.png", color: "#22C55E", count: "30 élèves" },
  { name: "Ceinture bleue", image: "/we-discipline/blue-belt.png", color: "#2563EB", count: "24 élèves" },
  { name: "Ceinture marron", image: "/we-discipline/brown-belt.png", color: "#7C4A2D", count: "17 élèves" },
  { name: "Ceinture noire", image: "/we-discipline/black-belt.png", color: "#111827", count: "28 élèves" },
];

const features: Feature[] = [
  {
    title: "Dossiers membres",
    description: "Fiches élèves, responsables, contacts, abonnements et historique accessibles en quelques secondes.",
    icon: Users,
  },
  {
    title: "Séances & présences",
    description: "Planifiez les cours, pointez les présences et suivez l'assiduité par groupe ou discipline.",
    icon: CalendarCheck,
  },
  {
    title: "Cotisations & impayés",
    description: "Pilotez les abonnements, encaissements, échéances et relances depuis une vue financière claire.",
    icon: CreditCard,
  },
  {
    title: "Groupes & familles",
    description: "Structurez enfants, adultes, familles, niveaux et groupes de travail sans perdre le lien humain.",
    icon: Medal,
  },
  {
    title: "Relances & messages",
    description: "Gardez le contact avec les élèves, parents et coachs pour les absences, paiements et annonces.",
    icon: MessageCircle,
  },
  {
    title: "Pilotage du club",
    description: "Suivez membres actifs, chiffre d'affaires, recouvrement, séances du jour et priorités à traiter.",
    icon: BarChart3,
  },
];

const dashboardStats = [
  { label: "Membres actifs", value: "187", icon: Users, change: "+12 ce mois" },
  { label: "Présences", value: "92%", icon: CalendarCheck, change: "+4% cette semaine" },
  { label: "CA du mois", value: "18 450€", icon: CircleDollarSign, change: "+14% ce mois" },
  { label: "Séances", value: "48", icon: CalendarCheck, change: "Cette semaine" },
  { label: "Impayés", value: "12", icon: CreditCard, change: "À traiter" },
];

const values = [
  {
    title: "Discipline",
    description: "La constance crée l'excellence.",
    icon: ShieldCheck,
  },
  {
    title: "Respect",
    description: "Bâtissez des communautés plus fortes.",
    icon: Users,
  },
  {
    title: "Progrès",
    description: "Suivez chaque étape du parcours.",
    icon: Target,
  },
];

const socialStats: Stat[] = [
  { value: 18450, suffix: "+", label: "Élèves gérés", icon: Users },
  { value: 320, suffix: "+", label: "Académies", icon: Building2 },
  { value: 98, suffix: "%", label: "Satisfaction client", icon: Trophy },
  { value: 25, suffix: "+", label: "Pays", icon: Globe2 },
];

const pricingPlans = [
  {
    name: "Ceinture Blanche",
    price: "29€",
    beltImage: "/we-discipline/white-belt.png",
    beltColor: "#F8FAFC",
    description: "Pour poser les bases d'un dojo organisé.",
    features: ["Jusqu'à 100 élèves", "Dossiers membres", "Présences du jour", "Abonnements simples", "Support par email"],
    highlighted: false,
  },
  {
    name: "Ceinture Marron",
    price: "79€",
    beltImage: "/we-discipline/brown-belt.png",
    beltColor: "#7C4A2D",
    description: "Pour les académies en croissance qui veulent piloter avec rigueur.",
    features: [
      "Élèves illimités",
      "Groupes & familles",
      "Relances d'impayés",
      "Tableau de bord avancé",
      "Communication ciblée",
    ],
    highlighted: true,
  },
  {
    name: "Ceinture Noire",
    price: "Sur mesure",
    beltImage: "/we-discipline/black-belt.png",
    beltColor: "#111827",
    description: "Pour les réseaux, fédérations et clubs multisites.",
    features: ["Multi-académies", "Rôles avancés", "Accompagnement dédié", "Pilotage réseau", "Priorité support"],
    highlighted: false,
  },
];

const faqs = [
  {
    question: "We Discipline convient-il à toutes les disciplines martiales ?",
    answer:
      "Oui. Karaté, judo, taekwondo, jiu-jitsu, MMA, boxe ou disciplines hybrides: la structure s'adapte aux groupes, grades, cours, familles et compétitions de votre académie.",
  },
  {
    question: "Puis-je suivre les passages de ceinture ?",
    answer:
      "Oui. Vous pouvez organiser les ceintures, préparer les examens, repérer les élèves prêts et garder l'historique de progression de chaque pratiquant.",
  },
  {
    question: "Les parents peuvent-ils recevoir des communications ?",
    answer:
      "Oui. La plateforme centralise les contacts et permet de communiquer avec les élèves, les parents, les coachs ou des groupes précis.",
  },
  {
    question: "Combien de temps faut-il pour démarrer ?",
    answer:
      "La configuration initiale prend quelques minutes. Vous pouvez ensuite importer vos élèves, créer vos groupes et commencer à pointer les cours.",
  },
  {
    question: "Puis-je demander une démonstration ?",
    answer:
      "Oui. La démo montre comment gérer une vraie semaine de dojo: inscriptions, présences, paiements, grades et suivi de la progression.",
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function LogoLockup({ variant = "footer" }: { dark?: boolean; variant?: "navbar" | "footer" }) {
  if (variant === "navbar") {
    return (
      <Link href="/accueil" className="relative block h-12 w-[150px]" aria-label="Accueil We Discipline">
        <Image
          src="/we-discipline/navbar-logo.svg"
          alt="We Discipline"
          fill
          sizes="150px"
          className="object-contain"
          priority
          unoptimized
        />
      </Link>
    );
  }

  return (
    <Link href="/accueil" className="relative block h-28 w-48" aria-label="Accueil We Discipline">
      <Image
        src="/we-discipline/footer-logo.png"
        alt="We Discipline"
        fill
        sizes="192px"
        className="object-contain object-left"
        priority
      />
    </Link>
  );
}

function CtaButton({
  children,
  href,
  variant = "primary",
  icon: Icon,
}: {
  children: React.ReactNode;
  href: string;
  variant?: "primary" | "secondary" | "dark";
  icon?: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-5 text-sm font-bold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#38BDF8]",
        variant === "primary" && "bg-[#2563EB] !text-white shadow-[0_18px_45px_rgba(37,99,235,0.28)] hover:bg-[#1D4ED8]",
        variant === "secondary" && "border border-slate-300 bg-white text-[#111827] hover:border-[#2563EB] hover:text-[#2563EB]",
        variant === "dark" && "border border-white/18 bg-white/10 text-white hover:bg-white hover:text-[#111827]",
      )}
    >
      {children}
      {Icon ? <Icon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /> : null}
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  dark = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  dark?: boolean;
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      {eyebrow ? (
        <p className={cn("text-xs font-extrabold uppercase tracking-[0.18em]", dark ? "text-[#38BDF8]" : "text-[#2563EB]")}>
          {eyebrow}
        </p>
      ) : null}
      <h2 className={cn("mt-3 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl", dark ? "text-white" : "text-[#111827]")}>
        {title}
      </h2>
      {description ? (
        <p className={cn("mt-4 text-base leading-7 sm:text-lg", dark ? "text-slate-300" : "text-slate-600")}>{description}</p>
      ) : null}
    </div>
  );
}

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;

    let frame = 0;
    const totalFrames = 72;
    const timer = window.setInterval(() => {
      frame += 1;
      const progress = 1 - Math.pow(1 - frame / totalFrames, 3);
      setCount(Math.round(value * progress));
      if (frame >= totalFrames) {
        window.clearInterval(timer);
        setCount(value);
      }
    }, 18);

    return () => window.clearInterval(timer);
  }, [inView, value]);

  return (
    <span ref={ref}>
      {new Intl.NumberFormat("fr-FR").format(count)}
      {suffix}
    </span>
  );
}

function DashboardMockup({ compact = false }: { compact?: boolean }) {
  const rows = [
    { name: "Lina Martin", belt: "Bleue", age: 12, attendance: "93%" },
    { name: "Adam Benali", belt: "Jaune", age: 10, attendance: "88%" },
    { name: "Noé Laurent", belt: "Verte", age: 14, attendance: "95%" },
    { name: "Camille Dubois", belt: "Blanche", age: 8, attendance: "85%" },
  ];
  const topStats = compact
    ? [
        { label: "Membres", value: "187", icon: Users, change: "+12 ce mois" },
        { label: "Présence", value: "92%", icon: CalendarCheck, change: "+4% semaine" },
        { label: "CA", value: "18,4k€", icon: CircleDollarSign, change: "+14% ce mois" },
      ]
    : dashboardStats.slice(0, 3);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-slate-200 bg-white text-[#111827] shadow-[0_28px_80px_rgba(15,23,42,0.22)]",
        compact ? "w-[min(100%,30rem)]" : "w-full",
      )}
    >
      <div className={cn("flex", compact ? "min-h-[17rem]" : "min-h-[21rem]")}>
        <aside className={cn("hidden shrink-0 bg-[#0B1220] text-white sm:block", compact ? "w-24 p-3" : "w-36 p-4")}>
          <Link href="/accueil" className={cn("relative block", compact ? "h-6 w-16" : "h-8 w-24")} aria-label="Accueil We Discipline">
            <Image
              src="/we-discipline/navbar-logo.svg"
              alt="We Discipline"
              fill
              sizes={compact ? "64px" : "96px"}
              className="object-contain object-left"
              unoptimized
            />
          </Link>
          <nav className={cn("space-y-1 font-semibold text-slate-400", compact ? "mt-4 text-[0.65rem]" : "mt-5 text-[0.7rem]")}>
            {(compact ? ["Vue", "Élèves", "Présences", "Grades", "Paiements"] : ["Vue globale", "Élèves", "Présences", "Cours", "Grades", "Paiements"]).map((item, index) => (
              <div
                key={item}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-2",
                  index === 1 ? "bg-[#2563EB] text-white" : "hover:bg-white/5",
                )}
              >
                <span className="size-1.5 rounded-full bg-current" />
                {item}
              </div>
            ))}
          </nav>
        </aside>
        <div className={cn("min-w-0 flex-1", compact ? "p-3" : "p-4 sm:p-5")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={cn("font-bold uppercase tracking-[0.16em] text-[#2563EB]", compact ? "text-[0.68rem]" : "text-xs")}>Tableau de bord</p>
              <h3 className={cn("mt-1 font-black", compact ? "text-lg" : "text-xl")}>{compact ? "Dojo central" : "Académie principale"}</h3>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <Clock3 className="size-3.5" aria-hidden="true" />
              Aujourd’hui
            </div>
          </div>

          <div className={cn("grid sm:grid-cols-3", compact ? "mt-4 gap-2" : "mt-5 gap-3")}>
            {topStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className={cn("rounded-md border border-slate-200 bg-white shadow-sm", compact ? "p-2.5" : "p-3")}>
                  <div className="flex items-center justify-between">
                    <p className={cn("font-bold uppercase text-slate-500", compact ? "text-[0.58rem] tracking-[0.08em]" : "text-[0.68rem] tracking-[0.12em]")}>{stat.label}</p>
                    <Icon className="size-4 text-[#2563EB]" aria-hidden="true" />
                  </div>
                  <p className={cn("mt-2 font-black", compact ? "text-xl" : "text-2xl")}>{stat.value}</p>
                  <p className="mt-1 text-xs font-semibold text-[#10B981]">{stat.change}</p>
                </div>
              );
            })}
          </div>

          <div className={cn("grid", compact ? "mt-4 grid-cols-[0.9fr_1.1fr] gap-3" : "mt-5 gap-4 lg:grid-cols-[0.8fr_1.2fr]")}>
            <div className={cn("rounded-md border border-slate-200 bg-slate-50", compact ? "p-3" : "p-4")}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-black">Progression</p>
                <span className="text-xs font-bold text-slate-500">187 élèves</span>
              </div>
              <div className={cn("mt-4 rounded-full bg-[conic-gradient(#2563EB_0_26%,#FACC15_26%_44%,#FB923C_44%_61%,#22C55E_61%_76%,#7C4A2D_76%_88%,#111827_88%_100%)]", compact ? "mx-auto size-28 p-3" : "aspect-square p-4")}>
                <div className="flex h-full flex-col items-center justify-center rounded-full bg-white">
                  <span className={cn("font-black", compact ? "text-2xl" : "text-3xl")}>187</span>
                  <span className="text-xs font-bold text-slate-500">élèves</span>
                </div>
              </div>
            </div>

            {compact ? (
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black">Priorités</p>
                  <span className="rounded-full bg-[#10B981]/10 px-2 py-1 text-[0.65rem] font-black text-[#047857]">Aujourd’hui</span>
                </div>
                <div className="mt-3 space-y-2 text-xs font-semibold text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <span>Relances impayées</span>
                    <span className="font-black text-[#111827]">12</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Cours à préparer</span>
                    <span className="font-black text-[#111827]">6</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Élèves prêts au grade</span>
                    <span className="font-black text-[#111827]">18</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-slate-200">
                <div className="grid grid-cols-[1.4fr_0.7fr_0.6fr] bg-slate-50 px-3 py-2 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-500 sm:grid-cols-[1.5fr_0.8fr_0.6fr_1fr]">
                  <span>Élève</span>
                  <span>Ceinture</span>
                  <span>Âge</span>
                  <span className="hidden sm:block">Présence</span>
                </div>
                {rows.map((row) => (
                  <div
                    key={row.name}
                    className="grid grid-cols-[1.4fr_0.7fr_0.6fr] items-center border-t border-slate-100 px-3 py-3 text-xs sm:grid-cols-[1.5fr_0.8fr_0.6fr_1fr]"
                  >
                    <span className="font-bold">{row.name}</span>
                    <span>{row.belt}</span>
                    <span>{row.age}</span>
                    <span className="hidden items-center gap-2 sm:flex">
                      <span className="h-1.5 w-16 rounded-full bg-slate-200">
                        <span className="block h-full rounded-full bg-[#10B981]" style={{ width: row.attendance }} />
                      </span>
                      {row.attendance}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/[0.92] backdrop-blur-xl transition-all duration-300",
        scrolled ? "shadow-[0_12px_35px_rgba(15,23,42,0.08)]" : "shadow-none",
      )}
    >
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8" aria-label="Navigation principale">
        <LogoLockup variant="navbar" />
        <div className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="text-sm font-bold text-slate-700 transition hover:text-[#2563EB]">
              {item.label}
            </a>
          ))}
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/login" className="text-sm font-bold text-[#111827] transition hover:text-[#2563EB]">
            Connexion
          </Link>
          <CtaButton href="#tarifs" icon={ArrowRight}>
            Démarrer l’essai gratuit
          </CtaButton>
        </div>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-md border border-slate-200 bg-white text-[#111827] lg:hidden"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
      </nav>

      {open ? (
        <div className="border-t border-slate-200 bg-white px-5 py-5 shadow-xl lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <Link href="/login" className="rounded-md px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Connexion
            </Link>
            <CtaButton href="#tarifs" icon={ArrowRight}>
              Démarrer l’essai gratuit
            </CtaButton>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_12%_18%,rgba(56,189,248,0.16),transparent_28%),linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_58%,#FFFFFF_100%)] pt-24 lg:pt-28">
      <div className="absolute right-[8%] top-24 hidden text-[18rem] font-black leading-none text-[#2563EB]/[0.035] lg:block">WD</div>
      <div className="relative mx-auto grid min-h-[690px] max-w-7xl items-center gap-12 px-5 pb-12 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="max-w-2xl">
          <motion.div variants={itemVariants} className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#2563EB]/15 bg-[#2563EB]/8 px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#2563EB] sm:text-xs sm:tracking-[0.16em]">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Plateforme de gestion pour arts martiaux
          </motion.div>
          <motion.h1 variants={itemVariants} className="mt-7 text-4xl font-black leading-[0.96] tracking-tight text-[#111827] sm:text-6xl lg:text-[4.3rem] xl:text-[4.85rem]">
            Bâtissez des champions.
            <span className="block text-[#2563EB]">Gérez votre académie.</span>
          </motion.h1>
          <motion.p variants={itemVariants} className="mt-7 max-w-2xl text-base leading-8 text-slate-600 sm:text-xl">
            De la ceinture blanche à la ceinture noire, gérez élèves, coachs, abonnements, présences, compétitions et paiements depuis une seule plateforme puissante.
          </motion.p>
          <motion.div variants={itemVariants} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CtaButton href="#tarifs" icon={ArrowRight}>
              Démarrer l’essai gratuit
            </CtaButton>
            <CtaButton href="#demo" variant="secondary" icon={CalendarCheck}>
              Réserver une démo
            </CtaButton>
          </motion.div>
          <motion.div variants={itemVariants} className="mt-8 grid gap-3 text-sm font-semibold text-slate-600 sm:grid-cols-3">
            {trustItems.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[#2563EB]" aria-hidden="true" />
                {item}
              </div>
            ))}
          </motion.div>
          <motion.div variants={itemVariants} className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-[#111827] shadow-[0_20px_60px_rgba(15,23,42,0.18)] lg:hidden">
            <div className="relative aspect-square">
              <Image
                src={assets.coach}
                alt="Coach d'arts martiaux dans un dojo moderne"
                fill
                sizes="100vw"
                className="object-cover object-[88%_center]"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#111827]/5 via-transparent to-[#111827]/18" />
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-12 hidden min-h-[440px] overflow-visible lg:mt-0 lg:block lg:min-h-[570px]"
        >
          <div className="absolute right-0 top-10 h-[455px] w-[78%] overflow-hidden rounded-lg bg-[#111827] shadow-[0_35px_90px_rgba(17,24,39,0.24)]">
            <Image
              src={assets.coach}
              alt="Coach d'arts martiaux en kimono, symbole de leadership et d'autorité"
              fill
              priority
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover object-[82%_center]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#111827]/5 via-transparent to-[#111827]/8" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.65 }}
            className="absolute bottom-3 left-0 w-[94%] max-w-[43rem] xl:left-0"
          >
            <div className="overflow-hidden rounded-lg border border-white/50 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.26)]">
              <Image
                src="/we-discipline/hero-dashboard-reception.png"
                alt="Tableau de bord réception We Discipline avec séances, encaissements et membres"
                width={1536}
                height={1024}
                sizes="(min-width: 1280px) 680px, (min-width: 1024px) 56vw, 100vw"
                className="h-auto w-full object-cover"
                priority
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function DojoAtmosphere() {
  return (
    <section id="solutions" className="relative min-h-[420px] overflow-hidden bg-[#111827]">
      <Image src={assets.dojo} alt="Dojo moderne avec élèves alignés pendant l'entraînement" fill sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-[#111827]/62" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#111827] via-[#111827]/48 to-transparent" />
      <div className="relative mx-auto flex min-h-[420px] max-w-7xl items-center px-5 py-20 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#38BDF8]">Pensé pour le dojo</p>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">Chaque cours, chaque grade, chaque progrès mérite un système à la hauteur.</h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            We Discipline respecte la logique d’une académie: transmission, assiduité, familles, compétitions et progression sur le long terme.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function BeltProgression() {
  return (
    <section id="progression" className="relative overflow-hidden bg-[#070B12] py-20 text-white">
      <Image src={assets.texture} alt="" fill sizes="100vw" className="object-cover opacity-[0.16]" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#070B12]/70 via-[#111827]/94 to-[#070B12]" />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Progression"
          title="Chaque champion commence quelque part"
          description="Visualisez le parcours complet de vos pratiquants, du premier salut à la maîtrise."
          align="center"
          dark
        />
        <div className="relative mt-14">
          <div className="absolute left-12 right-12 top-[4.7rem] hidden h-px bg-white/16 lg:block" />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-7">
            {beltJourney.map((belt, index) => (
              <motion.div
                key={belt.name}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06, duration: 0.45 }}
                className="group relative overflow-hidden rounded-md border border-white/8 bg-white/[0.025] p-3 text-center transition duration-300 hover:border-white/18 hover:bg-white/[0.045]"
              >
                <div className={cn("relative z-10 flex h-28 items-center justify-center rounded-md", belt.name === "Ceinture noire" ? "bg-white/[0.08]" : "bg-white/[0.025]")}>
                  <Image
                    src={belt.image}
                    alt={belt.name}
                    width={220}
                    height={140}
                    sizes="(min-width: 1024px) 150px, (min-width: 768px) 45vw, 90vw"
                    className="h-auto max-h-24 w-full object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.35)] transition duration-300 group-hover:scale-105"
                  />
                </div>
                <span
                  className="mx-auto mt-4 block h-1.5 w-16 rounded-full"
                  style={{ backgroundColor: belt.name === "Ceinture noire" ? "#F8FAFC" : belt.color }}
                  aria-hidden="true"
                />
                <p className="mt-4 text-sm font-black uppercase tracking-[0.08em]">{belt.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">{belt.count}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="fonctionnalites" className="bg-[#F6F9FF] py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Fonctionnalités puissantes"
          title="Les opérations réelles d'un club, sans friction."
          description="We Discipline reprend le rythme d'une journée de dojo: inscriptions, séances, familles, paiements et priorités du bureau."
          align="center"
        />
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-120px" }}
          className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.article
                key={feature.title}
                variants={itemVariants}
                className="group rounded-md border border-slate-200 bg-white p-7 shadow-[0_18px_45px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-[#2563EB]/35 hover:shadow-[0_24px_60px_rgba(37,99,235,0.12)]"
              >
                <div className="flex size-12 items-center justify-center rounded-md border border-[#2563EB]/10 bg-[#2563EB]/8 text-[#2563EB] transition group-hover:bg-[#2563EB] group-hover:text-white">
                  <Icon className="size-6" aria-hidden="true" />
                </div>
                <h3 className="mt-6 text-xl font-black text-[#111827]">{feature.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{feature.description}</p>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function AcademyDashboard() {
  return (
    <section id="tableau-de-bord" className="overflow-hidden bg-[#F6F9FF] py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[0.82fr_1.18fr]">
          <motion.div
            initial={{ opacity: 0, x: -28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 0.65 }}
          >
            <SectionHeading
              eyebrow="Votre académie en un coup d'oeil"
              title="Toutes vos données. Un seul tableau de bord."
              description="Gardez le contrôle sur l'énergie du club: élèves, cours, finances, compétitions et examens."
            />
            <div className="mt-8 grid gap-3">
              {[
                "Vue temps réel de l'activité de votre académie",
                "Suivi des élèves, groupes, coachs et familles",
                "Pilotage des paiements, renouvellements et relances",
                "Mesure de la performance et de la progression",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm font-bold text-slate-700">
                  <CheckCircle2 className="size-5 text-[#2563EB]" aria-hidden="true" />
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 0.65 }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-lg bg-[#2563EB]/10 blur-3xl" />
            <div className="relative">
              <DashboardMockup />
            </div>
          </motion.div>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-5">
          {dashboardStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <Icon className="size-5 text-[#2563EB]" aria-hidden="true" />
                <p className="mt-4 text-2xl font-black text-[#111827]">{stat.value}</p>
                <p className="mt-1 text-sm font-bold text-slate-500">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CommunitySection() {
  return (
    <section id="demo" className="bg-white py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-2 lg:px-8">
        <motion.div
          initial={{ opacity: 0, x: -28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.65 }}
          className="relative overflow-hidden rounded-lg"
        >
          <div className="relative aspect-[4/3]">
            <Image
              src={assets.mentorship}
              alt="Coach aidant un enfant pendant un cours d'arts martiaux"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#111827]/55 via-transparent to-transparent" />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.65 }}
        >
          <SectionHeading
            eyebrow="Communauté & mentorat"
            title="Plus qu'un logiciel. Un lien entre coachs, élèves et familles."
            description="Le coeur d'un dojo, ce n'est pas la base de données. Ce sont les relations. We Discipline libère du temps pour enseigner, transmettre et élever le niveau du groupe."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {["Transmission coach-élève", "Suivi familial clair", "Groupes et niveaux structurés", "Culture du progrès visible"].map((item) => (
              <div key={item} className="rounded-md border border-slate-200 bg-[#F8FAFC] p-4">
                <Check className="size-5 text-[#10B981]" aria-hidden="true" />
                <p className="mt-3 text-sm font-black text-[#111827]">{item}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ValuesSection() {
  return (
    <section id="valeurs" className="relative overflow-hidden bg-[#070B12] py-24 text-white">
      <Image src={assets.texture} alt="" fill sizes="100vw" className="object-cover opacity-[0.11]" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(37,99,235,0.22),transparent_32%)]" />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Valeurs"
          title="Le logiciel doit servir la culture du dojo."
          description="Discipline, respect et progression ne sont pas des slogans: ce sont les repères qui structurent toute l'expérience."
          align="center"
          dark
        />
        <div className="mt-14 grid items-center gap-8 lg:grid-cols-[0.95fr_1.1fr_0.95fr]">
          <div className="grid gap-5">
            {values.slice(0, 2).map((value) => {
              const Icon = value.icon;
              return (
                <motion.article
                  key={value.title}
                  initial={{ opacity: 0, x: -24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="rounded-md border border-white/10 bg-white/[0.055] p-6 backdrop-blur"
                >
                  <Icon className="size-8 text-[#38BDF8]" aria-hidden="true" />
                  <h3 className="mt-5 text-2xl font-black">{value.title}</h3>
                  <p className="mt-2 text-slate-300">{value.description}</p>
                </motion.article>
              );
            })}
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 0.75 }}
            className="relative mx-auto w-full max-w-[31rem] overflow-hidden rounded-lg border border-white/10 shadow-[0_28px_90px_rgba(0,0,0,0.45)]"
          >
            <div className="relative aspect-[2/3]">
              <Image
                src={assets.champion}
                alt="Silhouette de champions d'arts martiaux dans un dojo sombre"
                fill
                sizes="(min-width: 1024px) 34vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#070B12] via-transparent to-transparent" />
            </div>
          </motion.div>
          <div className="grid gap-5">
            {values.slice(2).map((value) => {
              const Icon = value.icon;
              return (
                <motion.article
                  key={value.title}
                  initial={{ opacity: 0, x: 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="rounded-md border border-white/10 bg-white/[0.055] p-6 backdrop-blur"
                >
                  <Icon className="size-8 text-[#38BDF8]" aria-hidden="true" />
                  <h3 className="mt-5 text-2xl font-black">{value.title}</h3>
                  <p className="mt-2 text-slate-300">{value.description}</p>
                </motion.article>
              );
            })}
            <div className="rounded-md border border-[#2563EB]/30 bg-[#2563EB]/12 p-6">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#38BDF8]">Mentalité championnat</p>
              <p className="mt-3 text-xl font-black">Des habitudes mesurables. Une culture qui monte en grade.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SocialProofSection() {
  return (
    <section className="bg-[#0B1220] py-14 text-white">
      <div className="mx-auto grid max-w-7xl gap-5 px-5 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {socialStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex items-center gap-5 border-white/10 py-5 lg:border-r last:border-r-0">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.06]">
                <Icon className="size-6 text-[#38BDF8]" aria-hidden="true" />
              </div>
              <div>
                <p className="text-4xl font-black tracking-tight">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-300">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="tarifs" className="relative overflow-hidden bg-[#070B12] py-24 text-white">
      <Image src={assets.texture} alt="" fill sizes="100vw" className="object-cover opacity-[0.12]" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#070B12] via-[#111827]/96 to-[#070B12]" />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Tarifs"
          title="Choisissez votre ceinture de gestion."
          description="Commencez avec les bases, puis montez en puissance à mesure que votre académie grandit."
          align="center"
          dark
        />
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <motion.article
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={cn(
                "relative overflow-hidden rounded-md border p-7 shadow-[0_30px_90px_rgba(0,0,0,0.22)]",
                plan.highlighted
                  ? "border-[#38BDF8]/70 bg-white text-[#111827]"
                  : "border-white/10 bg-white/[0.055] text-white backdrop-blur",
              )}
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: plan.name === "Ceinture Noire" ? "#F8FAFC" : plan.beltColor }} aria-hidden="true" />
              {plan.highlighted ? (
                <span className="absolute right-5 top-5 rounded-full bg-[#38BDF8] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#111827]">
                  Recommandé
                </span>
              ) : null}
              <div className={cn("flex h-24 items-center", plan.highlighted ? "justify-start" : "justify-center")}>
                <Image
                  src={plan.beltImage}
                  alt={plan.name}
                  width={180}
                  height={110}
                  sizes="180px"
                  className="max-h-20 w-full max-w-[11rem] object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.25)]"
                />
              </div>
              <h3 className="mt-5 text-2xl font-black">{plan.name}</h3>
              <p className={cn("mt-3 min-h-14 leading-7", plan.highlighted ? "text-slate-600" : "text-slate-300")}>{plan.description}</p>
              <div className="mt-8 flex items-end gap-2">
                <span className="text-5xl font-black tracking-tight">{plan.price}</span>
                {plan.price !== "Sur mesure" ? (
                  <span className={cn("pb-2 text-sm font-bold", plan.highlighted ? "text-slate-500" : "text-slate-400")}>/mois</span>
                ) : null}
              </div>
              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm font-semibold">
                    <CheckCircle2 className={cn("mt-0.5 size-5 shrink-0", plan.highlighted ? "text-[#38BDF8]" : "text-[#10B981]")} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <CtaButton href="#demo" variant={plan.highlighted ? "primary" : "dark"} icon={ArrowRight}>
                  {plan.name === "Ceinture Noire" ? "Contacter l'équipe" : plan.highlighted ? "Démarrer Ceinture Marron" : "Choisir Ceinture Blanche"}
                </CtaButton>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="bg-[#F6F9FF] py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions fréquentes des clubs."
          description="Des réponses directes pour les propriétaires d'académies, coachs et managers qui veulent avancer vite."
        />
        <div className="space-y-3">
          {faqs.map((item, index) => {
            const isOpen = index === openIndex;
            return (
              <div key={item.question} className="rounded-md border border-slate-200 bg-white">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left text-base font-black text-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#38BDF8]"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                >
                  {item.question}
                  <ChevronDown className={cn("size-5 shrink-0 text-[#2563EB] transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
                </button>
                <motion.div initial={false} animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }} className="overflow-hidden">
                  <p className="px-5 pb-5 leading-7 text-slate-600">{item.answer}</p>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[#070B12] py-24 text-white">
      <Image src={assets.texture} alt="" fill sizes="100vw" className="object-cover opacity-[0.13]" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#070B12] via-[#111827]/94 to-[#070B12]" />
      <div className="absolute right-[-2rem] top-1/2 -translate-y-1/2 text-[18rem] font-black leading-none text-white/[0.035] sm:text-[25rem]">
        WD
      </div>
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <div className="max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#38BDF8]">Passez au niveau supérieur</p>
          <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">
            Concentrez-vous sur l’enseignement.
            <span className="block text-[#38BDF8]">We Discipline gère le reste.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Rejoignez les académies qui structurent leur croissance sans perdre leur exigence, leur culture et leur esprit de communauté.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <CtaButton href="#tarifs" icon={ArrowRight}>
              Démarrer l’essai gratuit
            </CtaButton>
            <CtaButton href="#demo" variant="dark" icon={CalendarCheck}>
              Planifier une démo
            </CtaButton>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#05070B] py-12 text-white">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div>
            <LogoLockup dark variant="footer" />
            <p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">
              Plateforme de gestion premium pour les clubs d’arts martiaux qui veulent bâtir des champions et piloter avec excellence.
            </p>
          </div>
          {footerGroups.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-300">{group.title}</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-400">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="transition hover:text-white">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col justify-between gap-5 border-t border-white/10 pt-6 text-sm text-slate-500 sm:flex-row">
          <p>© 2026 We Discipline. Tous droits réservés.</p>
          <div className="flex gap-4">
            <a href="mailto:contact@wediscipline.com" className="inline-flex items-center gap-2 transition hover:text-white">
              <Mail className="size-4" aria-hidden="true" />
              Contact
            </a>
            <a href="#demo" className="inline-flex items-center gap-2 transition hover:text-white">
              <Star className="size-4" aria-hidden="true" />
              Réserver une démo
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function WeDisciplineHomepage({ fontClassName }: HomepageProps) {
  const pageSections = useMemo(
    () => [
      <HeroSection key="hero" />,
      <DojoAtmosphere key="dojo" />,
      <BeltProgression key="belts" />,
      <FeaturesSection key="features" />,
      <AcademyDashboard key="dashboard" />,
      <CommunitySection key="community" />,
      <ValuesSection key="values" />,
      <SocialProofSection key="proof" />,
      <PricingSection key="pricing" />,
      <FaqSection key="faq" />,
      <FinalCta key="cta" />,
    ],
    [],
  );

  return (
    <div className={cn(fontClassName, "min-h-screen bg-white text-[#111827]")}>
      <Navbar />
      <main>{pageSections}</main>
      <Footer />
    </div>
  );
}
