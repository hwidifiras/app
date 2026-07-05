"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Mail,
  Medal,
  Menu,
  MessageCircle,
  ShieldCheck,
  Star,
  Target,
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
  tag?: string;
};

type PricingPlan = {
  name: string;
  price: string;
  limit: string;
  badge?: string;
  beltImage: string;
  beltColor: string;
  description: string;
  features: string[];
  note?: string;
  cta: string;
  highlighted: boolean;
};

const assets = {
  coach: "/we-discipline/coach-portrait.webp",
  dojo: "/we-discipline/wide-dojo-interior.webp",
  mentorship: "/we-discipline/coach-helping-child.webp",
  champion: "/we-discipline/champion-silhouette.webp",
  texture: "/we-discipline/dojo-texture.webp",
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
      { label: "Modules par ceinture", href: "#progression" },
      { label: "Modules intelligents", href: "#modules" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Contact",
    links: [
      { label: "Demander une démo", href: "#demo" },
      { label: "Voir les tarifs", href: "#tarifs" },
      { label: "Nous écrire", href: "mailto:contact@wediscipline.com" },
      { label: "Connexion", href: "/login" },
    ],
  },
];

const trustItems = [
  "Tarifs en TND TTC",
  "Pointage manuel ou QR",
  "Adapté aux clubs d'arts martiaux",
  "Caisse, reçus et abonnements",
];

const beltFeatures = [
  {
    belt: "Ceinture blanche",
    title: "Dossiers élèves",
    description: "Centralisez les informations des membres, responsables, contacts, niveaux, certificats et historiques.",
    image: "/we-discipline/white-belt.webp",
    color: "#F8FAFC",
    label: "Inclus",
  },
  {
    belt: "Ceinture jaune",
    title: "Groupes & horaires",
    description: "Organisez les groupes par âge, discipline, niveau, coach et créneau.",
    image: "/we-discipline/yellow-belt.webp",
    color: "#FACC15",
    label: "Inclus",
  },
  {
    belt: "Ceinture orange",
    title: "Pointage manuel",
    description: "Pointez rapidement les présences par séance, groupe ou coach, même sans matériel.",
    image: "/we-discipline/orange-belt.webp",
    color: "#FB923C",
    label: "Inclus",
  },
  {
    belt: "Ceinture verte",
    title: "Caisse & abonnements",
    description: "Suivez les paiements, échéances, impayés, reçus et mouvements de caisse.",
    image: "/we-discipline/green-belt.webp",
    color: "#22C55E",
    label: "Pro",
  },
  {
    belt: "Ceinture bleue",
    title: "Pointage QR",
    description: "Accélérez l'accueil avec cartes QR, scan mobile, mode kiosque et contrôle d'abonnement.",
    image: "/we-discipline/blue-belt.webp",
    color: "#2563EB",
    label: "Avancé",
  },
  {
    belt: "Ceinture marron",
    title: "Comptes coachs",
    description: "Donnez aux coachs un accès limité pour gérer présences, groupes et progression.",
    image: "/we-discipline/brown-belt.webp",
    color: "#7C4A2D",
    label: "Premium",
  },
  {
    belt: "Ceinture noire",
    title: "Parents & notifications",
    description: "Informez les parents, relancez les impayés et suivez la présence des enfants.",
    image: "/we-discipline/black-belt.webp",
    color: "#111827",
    label: "Sur mesure",
  },
];

const features: Feature[] = [
  {
    title: "Élèves & membres",
    description: "Fiches élèves, responsables, contacts d'urgence, certificats, niveaux et historiques au même endroit.",
    icon: Users,
    tag: "Membres",
  },
  {
    title: "Parents & contacts",
    description: "Gardez les responsables, téléphones, autorisations et contacts familiaux prêts quand le club en a besoin.",
    icon: ShieldCheck,
    tag: "Familles",
  },
  {
    title: "Groupes & planning",
    description: "Organisez les groupes par âge, niveau, discipline, coach et créneau de séance.",
    icon: CalendarCheck,
    tag: "Planning",
  },
  {
    title: "Pointage manuel",
    description: "Pointez les présences par séance, groupe ou coach, sans matériel et sans ralentir l'accueil.",
    icon: CheckCircle2,
    tag: "Pointage",
  },
  {
    title: "Pointage QR",
    description: "Cartes membres QR, scan mobile, tablette ou webcam, mode kiosque et alerte d'abonnement expiré.",
    icon: Target,
    tag: "QR",
  },
  {
    title: "Abonnements & caisse",
    description: "Suivez les formules mensuelles, trimestrielles ou personnalisées, les échéances et la caisse journalière.",
    icon: CreditCard,
    tag: "Caisse",
  },
  {
    title: "Reçus imprimables",
    description: "Générez et imprimez les reçus avec les informations du club pour garder une trace claire.",
    icon: Medal,
    tag: "Reçus",
  },
  {
    title: "Impayés & historique",
    description: "Retrouvez les paiements, les retards, les relances et l'historique financier de chaque membre.",
    icon: CircleDollarSign,
    tag: "Suivi",
  },
  {
    title: "Coachs & permissions",
    description: "Créez des accès coachs limités aux groupes, séances et informations autorisées.",
    icon: Users,
    tag: "Équipe",
  },
  {
    title: "Ceintures & examens",
    description: "Suivez les grades, préparez les passages de ceinture et gardez l'historique de progression.",
    icon: Star,
    tag: "Grades",
  },
  {
    title: "Notifications & relances",
    description: "Informez parents, élèves et coachs pour absences, annonces, échéances et impayés selon l'offre.",
    icon: MessageCircle,
    tag: "Messages",
  },
  {
    title: "Rapports simples",
    description: "Lisez membres actifs, présences, paiements, impayés et priorités sans ouvrir dix fichiers.",
    icon: BarChart3,
    tag: "Rapports",
  },
];

const dashboardStats = [
  { label: "Membres actifs", value: "128", icon: Users },
  { label: "Séances ce mois", value: "24", icon: CalendarCheck },
  { label: "Abonnements à renouveler", value: "17", icon: CreditCard },
  { label: "Impayés à relancer", value: "9", icon: MessageCircle },
  { label: "Encaissements du mois", value: "4 850 TND", icon: CircleDollarSign },
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

const trustCards: Feature[] = [
  {
    title: "Moins de cahiers et d'Excel",
    description: "Les dossiers, groupes, paiements et présences restent propres, même pendant les heures chargées.",
    icon: CheckCircle2,
  },
  {
    title: "Une caisse plus claire",
    description: "Chaque encaissement, reçu, échéance et impayé garde une trace exploitable.",
    icon: CircleDollarSign,
  },
  {
    title: "Des présences mieux suivies",
    description: "Le bureau et les coachs voient rapidement qui est présent, absent ou en retard.",
    icon: CalendarCheck,
  },
  {
    title: "Des parents mieux informés",
    description: "Les informations importantes ne se perdent plus entre groupes, horaires et paiements.",
    icon: MessageCircle,
  },
  {
    title: "Des coachs mieux organisés",
    description: "Les accès coachs restent cadrés, utiles et alignés avec les responsabilités de chacun.",
    icon: Users,
  },
  {
    title: "Des reçus prêts à imprimer",
    description: "Le club peut remettre des justificatifs propres sans refaire le travail à la main.",
    icon: Medal,
  },
];

const pricingPlans: PricingPlan[] = [
  {
    name: "Ceinture Blanche",
    price: "49 TND TTC / mois",
    limit: "Jusqu'à 60 élèves",
    beltImage: "/we-discipline/white-belt.webp",
    beltColor: "#F8FAFC",
    description: "Pour commencer à organiser le club sans Excel.",
    features: [
      "Dossiers élèves et membres",
      "Groupes simples",
      "Pointage manuel",
      "Suivi des abonnements",
      "Suivi caisse basique",
      "Génération et impression des reçus",
      "Liste des impayés",
      "1 utilisateur administrateur",
      "Export simple PDF / Excel",
    ],
    cta: "Choisir l'offre Blanche",
    highlighted: false,
  },
  {
    name: "Ceinture Jaune",
    price: "79 TND TTC / mois",
    limit: "Jusqu'à 120 élèves",
    beltImage: "/we-discipline/yellow-belt.webp",
    beltColor: "#FACC15",
    description: "Pour les clubs qui veulent mieux structurer groupes, paiements et séances.",
    features: [
      "Tout dans Ceinture Blanche",
      "Groupes illimités",
      "Gestion des coachs",
      "Planning des séances",
      "Historique complet des présences",
      "Abonnements mensuels / trimestriels / personnalisés",
      "Caisse journalière plus détaillée",
      "Reçus personnalisés avec logo du club",
      "2 utilisateurs",
    ],
    cta: "Choisir l'offre Jaune",
    highlighted: false,
  },
  {
    name: "Ceinture Orange",
    price: "119 TND TTC / mois",
    limit: "Jusqu'à 250 élèves",
    badge: "Pointage QR",
    beltImage: "/we-discipline/orange-belt.webp",
    beltColor: "#FB923C",
    description: "Pour les clubs qui veulent accélérer l'accueil et moderniser le pointage.",
    features: [
      "Tout dans Ceinture Jaune",
      "Pointage par QR code",
      "Cartes membres QR imprimables",
      "Scan par téléphone, tablette ou webcam",
      "Mode kiosque réception",
      "Alertes abonnement expiré au scan",
      "Détection double pointage",
      "Statistiques de présence par groupe",
      "3 utilisateurs",
    ],
    cta: "Activer le QR",
    highlighted: false,
  },
  {
    name: "Ceinture Verte",
    price: "169 TND TTC / mois",
    limit: "Jusqu'à 400 élèves",
    badge: "Le plus recommandé",
    beltImage: "/we-discipline/green-belt.webp",
    beltColor: "#22C55E",
    description: "Pour les clubs en croissance qui veulent déléguer aux coachs.",
    features: [
      "Tout dans Ceinture Orange",
      "Comptes coachs",
      "Rôles et permissions",
      "Accès coach limité aux groupes",
      "Suivi progression / ceintures / grades",
      "Préparation passages de grade",
      "Notes internes sur les élèves",
      "Rapports paiements, présences et impayés",
      "5 utilisateurs",
    ],
    cta: "Choisir l'offre Verte",
    highlighted: true,
  },
  {
    name: "Ceinture Marron",
    price: "239 TND TTC / mois",
    limit: "Jusqu'à 700 élèves",
    beltImage: "/we-discipline/brown-belt.webp",
    beltColor: "#7C4A2D",
    description: "Pour les clubs qui veulent impliquer parents et élèves.",
    features: [
      "Tout dans Ceinture Verte",
      "Comptes élèves",
      "Portail parents / élèves",
      "Consultation présence et abonnement",
      "Notifications absences",
      "Relances automatiques des impayés",
      "Annonces par groupe",
      "Documents élèves",
      "Support prioritaire",
      "10 utilisateurs",
    ],
    note: "Les coûts SMS/WhatsApp, si utilisés, sont facturés séparément.",
    cta: "Choisir l'offre Marron",
    highlighted: false,
  },
  {
    name: "Ceinture Noire",
    price: "À partir de 349 TND TTC / mois",
    limit: "Illimité ou sur mesure",
    beltImage: "/we-discipline/black-belt.webp",
    beltColor: "#111827",
    description: "Pour grands clubs, réseaux, académies multi-salles ou besoins avancés.",
    features: [
      "Tout dans Ceinture Marron",
      "Multi-salles / multi-branches",
      "Tableaux de bord avancés",
      "Assistant intelligent pour priorités, impayés et absences",
      "Intégration scanner QR / code-barres",
      "Connecteur matériel RFID ou machine de pointage selon faisabilité",
      "Accompagnement configuration",
      "Formation équipe",
      "Support prioritaire",
      "Fonctionnalités sur mesure",
    ],
    note: "Matériel, installation, connecteurs spécifiques et SMS/WhatsApp peuvent être facturés séparément.",
    cta: "Demander une offre sur mesure",
    highlighted: false,
  },
];

const smartModules: Feature[] = [
  { title: "Pointage QR Pro", description: "Scan rapide avec contrôle d'abonnement et détection double pointage.", icon: Target },
  { title: "Mode kiosque réception", description: "Un écran simple à l'accueil pour fluidifier les arrivées.", icon: CalendarCheck },
  { title: "Cartes membres QR", description: "Cartes imprimables pour les élèves et membres du club.", icon: Medal },
  { title: "Scanner code-barres / QR", description: "Compatibilité matériel selon étude du modèle et des contraintes de confidentialité.", icon: ShieldCheck },
  { title: "Comptes coachs", description: "Accès limités par coach, groupe et responsabilité.", icon: Users },
  { title: "Portail parents & élèves", description: "Présence, abonnement, documents et informations utiles au même endroit.", icon: Users },
  { title: "Notifications et relances", description: "Absences, annonces, échéances et impayés selon l'offre choisie.", icon: MessageCircle },
  { title: "Progression ceintures & examens", description: "Suivi des grades, notes internes et passages de ceinture.", icon: Star },
  { title: "Caisse Pro", description: "Suivi caisse, reçus, impayés et historique des paiements.", icon: CircleDollarSign },
  { title: "Rapports avancés", description: "Présences, paiements, impayés et activité du club en lecture claire.", icon: BarChart3 },
  { title: "Connecteur matériel de pointage", description: "Étude possible pour scanner, QR, code-barres ou matériel compatible.", icon: CreditCard },
  { title: "Assistant intelligent club", description: "Priorités, absences et impayés à surveiller pour mieux organiser la semaine.", icon: ShieldCheck },
];

const faqs = [
  {
    question: "Est-ce que je peux commencer sans QR code ?",
    answer:
      "Oui. L'offre de base permet le pointage manuel par groupe et par séance. Le QR code peut être activé plus tard avec une offre supérieure.",
  },
  {
    question: "Les prix sont-ils en dinar tunisien ?",
    answer: "Oui. Les prix affichés sont en TND TTC par mois.",
  },
  {
    question: "Est-ce que le logiciel gère la caisse et les reçus ?",
    answer:
      "Oui. We Discipline permet de suivre les encaissements, les abonnements, les impayés et de générer ou imprimer les reçus selon l'offre choisie.",
  },
  {
    question: "Les coachs peuvent-ils avoir leurs propres comptes ?",
    answer:
      "Oui, à partir des offres avancées. Les coachs peuvent accéder uniquement aux groupes, séances et informations autorisées.",
  },
  {
    question: "Les parents peuvent-ils recevoir des notifications ?",
    answer:
      "Oui, les offres avancées peuvent inclure un portail parents / élèves et des notifications pour absences, annonces ou relances.",
  },
  {
    question: "Peut-on connecter une machine de pointage ?",
    answer:
      "C'est possible selon le modèle de matériel. Le connecteur matériel est réservé aux offres avancées ou sur mesure.",
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
        src="/we-discipline/footer-logo.webp"
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
        variant === "dark" && "border border-white/18 bg-white/10 text-white hover:border-[#38BDF8] hover:bg-[#2563EB] hover:text-white",
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
          <CtaButton href="#demo" icon={ArrowRight}>
            Demander une démo
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
            <CtaButton href="#demo" icon={ArrowRight}>
              Demander une démo
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
            Plateforme de gestion pour clubs d&apos;arts martiaux
          </motion.div>
          <motion.h1 variants={itemVariants} className="mt-7 text-4xl font-black leading-[0.96] tracking-tight text-[#111827] sm:text-6xl lg:text-[4.3rem] xl:text-[4.85rem]">
            Gérez votre club d&apos;arts martiaux
            <span className="block text-[#2563EB]">avec discipline.</span>
          </motion.h1>
          <motion.p variants={itemVariants} className="mt-7 max-w-2xl text-base leading-8 text-slate-600 sm:text-xl">
            Pointage, abonnements, caisse, groupes, coachs, élèves et reçus dans une seule plateforme simple, claire et adaptée aux clubs tunisiens.
          </motion.p>
          <motion.div variants={itemVariants} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CtaButton href="#demo" icon={ArrowRight}>
              Demander une démo
            </CtaButton>
            <CtaButton href="#tarifs" variant="secondary" icon={CalendarCheck}>
              Voir les tarifs
            </CtaButton>
          </motion.div>
          <motion.div variants={itemVariants} className="mt-8 grid gap-3 text-sm font-semibold text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
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
            className="absolute bottom-4 left-0 w-[96%] max-w-[43rem] xl:left-0"
          >
            <div className="overflow-hidden rounded-lg border border-white/50 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.26)]">
              <Image
                src="/we-discipline/hero-dashboard-reception.webp"
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
          <h2 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">Un club bien organisé laisse plus de place à l&apos;enseignement.</h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            We Discipline respecte le rythme réel d&apos;un club: accueil, pointage, caisse, parents, coachs, groupes et progression.
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
          title="Une progression claire, module par module."
          description="Les ceintures deviennent un repère simple pour comprendre ce que le club gagne à chaque niveau d'organisation."
          align="center"
          dark
        />
        <div className="relative mt-14">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {beltFeatures.map((belt, index) => (
              <motion.div
                key={belt.belt}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06, duration: 0.45 }}
                className={cn(
                  "group relative overflow-hidden rounded-md border p-4 transition duration-300 hover:-translate-y-1",
                  belt.belt === "Ceinture noire"
                    ? "border-white/24 bg-white/[0.08] shadow-[0_24px_70px_rgba(0,0,0,0.32)]"
                    : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.055]",
                )}
              >
                <div className={cn("relative z-10 flex h-24 items-center justify-center rounded-md", belt.belt === "Ceinture noire" ? "bg-white/[0.10]" : "bg-white/[0.035]")}>
                  <Image
                    src={belt.image}
                    alt={belt.belt}
                    width={220}
                    height={140}
                    sizes="(min-width: 1024px) 150px, (min-width: 768px) 45vw, 90vw"
                    className="h-auto max-h-24 w-full object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.35)] transition duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <span
                    className="block h-1.5 w-12 rounded-full"
                    style={{ backgroundColor: belt.belt === "Ceinture noire" ? "#F8FAFC" : belt.color }}
                    aria-hidden="true"
                  />
                  <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-slate-200">
                    {belt.label}
                  </span>
                </div>
                <p className="mt-4 text-xs font-black uppercase tracking-[0.1em] text-slate-400">{belt.belt}</p>
                <h3 className="mt-2 text-lg font-black leading-tight">{belt.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{belt.description}</p>
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
          title="Les modules essentiels pour gérer un club au quotidien."
          description="We Discipline est une plateforme de gestion pour clubs d'arts martiaux: pointage, abonnements, caisse, groupes, coachs, élèves, reçus, progression et communication."
          align="center"
        />
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-120px" }}
          className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.article
                key={feature.title}
                variants={itemVariants}
                className="group rounded-md border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-[#2563EB]/35 hover:shadow-[0_24px_60px_rgba(37,99,235,0.12)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-11 items-center justify-center rounded-md border border-[#2563EB]/10 bg-[#2563EB]/8 text-[#2563EB] transition group-hover:bg-[#2563EB] group-hover:text-white">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  {feature.tag ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500">
                      {feature.tag}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-5 text-lg font-black text-[#111827]">{feature.title}</h3>
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
              title="Toutes vos données utiles. Un seul tableau de bord."
              description="Gardez le contrôle sur la semaine du club: membres actifs, séances, abonnements à renouveler, impayés et encaissements du mois."
            />
            <div className="mt-8 grid gap-3">
              {[
                "Pointage manuel ou QR par séance, groupe et coach",
                "Caisse, reçus, paiements et impayés au même endroit",
                "Groupes, coachs, parents et rôles mieux structurés",
                "Rapports simples pour décider quoi traiter en premier",
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
            <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.18)]">
              <Image
                src="/we-discipline/hero-dashboard-reception.webp"
                alt="Tableau de bord We Discipline avec séances du jour, encaissements et aperçu des membres"
                width={1536}
                height={1024}
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="h-auto w-full object-cover"
              />
            </div>
          </motion.div>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
    <section className="bg-[#0B1220] py-20 text-white">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Confiance opérationnelle"
          title="Pensé pour la réalité quotidienne d'un club."
          description="Pas de chiffres inventés. Le produit doit surtout résoudre les vrais irritants du bureau, de l'accueil et du tatami."
          align="center"
          dark
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trustCards.map((card) => {
            const Icon = card.icon;
            return (
              <motion.article
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-md border border-white/10 bg-white/[0.055] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.18)]"
              >
                <div className="flex size-11 items-center justify-center rounded-md border border-white/10 bg-white/[0.08] text-[#38BDF8]">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-xl font-black">{card.title}</h3>
                <p className="mt-3 leading-7 text-slate-300">{card.description}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SmartModulesSection() {
  return (
    <section id="modules" className="bg-[#F6F9FF] py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Modules avancés"
          title="Modules intelligents disponibles"
          description="Activez les modules utiles au moment où votre club en a vraiment besoin: QR, portail parents, coachs, caisse avancée, rapports et matériel étudié au cas par cas."
          align="center"
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {smartModules.map((module) => {
            const Icon = module.icon;
            return (
              <motion.article
                key={module.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-md border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"
              >
                <Icon className="size-6 text-[#2563EB]" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-black text-[#111827]">{module.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{module.description}</p>
              </motion.article>
            );
          })}
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-center text-sm font-semibold leading-6 text-slate-500">
          Compatibilité matériel selon étude du modèle et des contraintes de confidentialité.
        </p>
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
          eyebrow="Tarifs de lancement en TND TTC"
          title="Des offres simples, adaptées à la taille de votre club."
          description="Commencez avec l'essentiel, puis ajoutez le QR, les comptes coachs, le portail parents, les notifications et les modules avancés quand votre club grandit."
          align="center"
          dark
        />
        <p className="mx-auto mt-6 max-w-4xl text-center text-sm font-semibold leading-6 text-slate-400">
          Tous les prix sont affichés en TND TTC / mois. Les options matériel, SMS, WhatsApp ou intégrations spécifiques peuvent être facturées séparément.
        </p>
        <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {pricingPlans.map((plan) => (
            <motion.article
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={cn(
                "relative overflow-hidden rounded-md border p-7 shadow-[0_30px_90px_rgba(0,0,0,0.22)]",
                plan.highlighted
                  ? "border-[#38BDF8]/70 bg-white text-[#111827] shadow-[0_34px_100px_rgba(56,189,248,0.18)]"
                  : "border-white/10 bg-white/[0.055] text-white backdrop-blur",
              )}
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: plan.name === "Ceinture Noire" ? "#F8FAFC" : plan.beltColor }} aria-hidden="true" />
              {plan.badge ? (
                <span
                  className={cn(
                    "absolute right-5 top-5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em]",
                    plan.highlighted ? "bg-[#38BDF8] text-[#111827]" : "bg-white/10 text-slate-200",
                  )}
                >
                  {plan.badge}
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
              <p className={cn("mt-2 text-sm font-black uppercase tracking-[0.12em]", plan.highlighted ? "text-[#2563EB]" : "text-[#38BDF8]")}>{plan.limit}</p>
              <p className={cn("mt-4 min-h-14 leading-7", plan.highlighted ? "text-slate-600" : "text-slate-300")}>{plan.description}</p>
              <div className="mt-7">
                <span className="text-3xl font-black tracking-tight sm:text-4xl">{plan.price}</span>
              </div>
              <ul className="mt-7 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm font-semibold">
                    <CheckCircle2 className={cn("mt-0.5 size-5 shrink-0", plan.highlighted ? "text-[#38BDF8]" : "text-[#10B981]")} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              {plan.note ? (
                <p className={cn("mt-6 rounded-md p-3 text-xs font-semibold leading-5", plan.highlighted ? "bg-slate-100 text-slate-600" : "bg-white/[0.07] text-slate-300")}>
                  {plan.note}
                </p>
              ) : null}
              <div className="mt-8">
                <CtaButton href="#demo" variant={plan.highlighted ? "primary" : "dark"} icon={ArrowRight}>
                  {plan.cta}
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
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#38BDF8]">Organisation du club</p>
          <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">
            Prêt à organiser votre club
            <span className="block text-[#38BDF8]">avec plus de discipline ?</span>
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Découvrez comment We Discipline peut simplifier le pointage, les abonnements, la caisse, les groupes et le suivi des élèves.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <CtaButton href="#demo" icon={ArrowRight}>
              Demander une démo
            </CtaButton>
            <CtaButton href="#tarifs" variant="dark" icon={CalendarCheck}>
              Voir les tarifs
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
              Plateforme de gestion pour clubs d&apos;arts martiaux: pointage, abonnements, caisse, groupes, coachs, élèves, reçus et communication.
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
              Demander une démo
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
      <SmartModulesSection key="modules" />,
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
