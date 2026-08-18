"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  CreditCard,
  LayoutDashboard,
  Menu,
  ReceiptText,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

type DemoView = "dashboard" | "attendance" | "members" | "payments" | "planning";

type NavItem = {
  id: DemoView;
  label: string;
  icon: LucideIcon;
  count?: number;
};

const navItems: NavItem[] = [
  { id: "dashboard", label: "Accueil", icon: LayoutDashboard },
  { id: "attendance", label: "Pointage", icon: ClipboardCheck, count: 2 },
  { id: "members", label: "Membres", icon: Users },
  { id: "payments", label: "Encaisser", icon: CreditCard, count: 6 },
  { id: "planning", label: "Planning", icon: CalendarDays },
];

const sessions = [
  { time: "17:00 - 18:00", name: "Taekwondo enfants", coach: "Sami Ben Amor", room: "Salle 1", expected: 14, present: 0, status: "À pointer" },
  { time: "18:15 - 19:30", name: "Kick-boxing adultes", coach: "Meriem Trabelsi", room: "Salle 2", expected: 18, present: 15, status: "En cours" },
  { time: "19:30 - 21:00", name: "Jiu-jitsu avancé", coach: "Hatem Gharbi", room: "Salle 1", expected: 12, present: 12, status: "À finaliser" },
];

const members = [
  { name: "Yassine Ben Amor", initials: "YB", plan: "Trimestriel", group: "Taekwondo enfants", status: "Actif", balance: "0,00 TND" },
  { name: "Inès Ayari", initials: "IA", plan: "Mensuel", group: "Kick-boxing adultes", status: "À renouveler", balance: "45,00 TND" },
  { name: "Ahmed Trabelsi", initials: "AT", plan: "Mensuel", group: "Jiu-jitsu avancé", status: "Actif", balance: "0,00 TND" },
  { name: "Malek Jaziri", initials: "MJ", plan: "Trimestriel", group: "Taekwondo enfants", status: "Paiement partiel", balance: "70,00 TND" },
  { name: "Nour Khelifi", initials: "NK", plan: "Mensuel", group: "Kick-boxing adultes", status: "Actif", balance: "0,00 TND" },
];

const payments = [
  { member: "Yassine Ben Amor", time: "09:42", method: "Espèces", amount: "120,00 TND", receipt: "WD-2026-000148" },
  { member: "Nour Khelifi", time: "11:05", method: "Carte", amount: "90,00 TND", receipt: "WD-2026-000149" },
  { member: "Ahmed Trabelsi", time: "14:18", method: "Espèces", amount: "120,00 TND", receipt: "WD-2026-000150" },
  { member: "Malek Jaziri", time: "15:31", method: "Espèces", amount: "90,00 TND", receipt: "WD-2026-000151" },
];

const notifications = [
  { title: "2 séances à finaliser", detail: "Les présences sont enregistrées mais les séances restent ouvertes.", tone: "warning" },
  { title: "6 paiements à suivre", detail: "Des abonnements actifs ont encore un reste à payer.", tone: "danger" },
  { title: "3 renouvellements cette semaine", detail: "Les membres concernés apparaissent dans le suivi abonnements.", tone: "info" },
];

const week = [
  { day: "Lun.", date: "17/08", sessions: [{ time: "18:00", title: "Taekwondo enfants" }] },
  { day: "Mar.", date: "18/08", sessions: [{ time: "17:00", title: "Kick-boxing adultes" }, { time: "19:30", title: "Jiu-jitsu avancé" }] },
  { day: "Mer.", date: "19/08", sessions: [{ time: "18:00", title: "Karaté débutants" }] },
  { day: "Jeu.", date: "20/08", sessions: [{ time: "17:00", title: "Taekwondo enfants" }, { time: "19:30", title: "Jiu-jitsu avancé" }] },
  { day: "Ven.", date: "21/08", sessions: [{ time: "18:15", title: "Kick-boxing adultes" }] },
  { day: "Sam.", date: "22/08", sessions: [{ time: "10:00", title: "Éveil martial" }, { time: "16:00", title: "Open mat" }] },
];

function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700">
      <ShieldCheck className="size-3.5" aria-hidden="true" />
      Données fictives
    </span>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-600">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function StatusPill({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "green" | "amber" | "red" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return <span className={`rounded-md px-2 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

function DashboardView({ onNavigate }: { onNavigate: (view: DemoView) => void }) {
  const bars = [34, 52, 44, 69, 58, 82, 64];
  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow="Tableau de bord"
        title="Aujourd'hui au club"
        description="Les séances, encaissements et priorités qui demandent une action."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          { label: "Membres actifs", value: "148", detail: "+7 ce mois", icon: Users, tone: "blue" },
          { label: "Caisse aujourd'hui", value: "420,00 TND", detail: "4 paiements", icon: CircleDollarSign, tone: "green" },
          { label: "À encaisser", value: "6", detail: "285,00 TND", icon: CreditCard, tone: "amber" },
          { label: "À finaliser", value: "2", detail: "séances", icon: ClipboardCheck, tone: "red" },
        ].map((metric) => {
          const Icon = metric.icon;
          const iconTone = metric.tone === "green" ? "bg-emerald-50 text-emerald-700" : metric.tone === "amber" ? "bg-amber-50 text-amber-700" : metric.tone === "red" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700";
          return (
            <div key={metric.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <span className={`inline-flex size-10 items-center justify-center rounded-lg ${iconTone}`}><Icon className="size-5" aria-hidden="true" /></span>
                <span className="text-xs font-semibold text-slate-400">Aujourd&apos;hui</span>
              </div>
              <p className="mt-5 break-words text-xl font-black text-slate-950 sm:text-2xl">{metric.value}</p>
              <p className="mt-1 text-sm font-bold text-slate-600">{metric.label}</p>
              <p className="mt-1 text-xs text-slate-400">{metric.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div><p className="text-xs font-black uppercase tracking-[0.13em] text-blue-600">Aujourd&apos;hui</p><h2 className="mt-1 text-lg font-black text-slate-950">Séances du jour</h2></div>
            <button type="button" onClick={() => onNavigate("attendance")} className="text-sm font-bold text-blue-600 hover:text-blue-800">Ouvrir</button>
          </div>
          <div className="divide-y divide-slate-100">
            {sessions.map((session) => (
              <button key={session.name} type="button" onClick={() => onNavigate("attendance")} className="grid w-full gap-3 px-5 py-4 text-left hover:bg-slate-50 sm:grid-cols-[116px_1fr_auto] sm:items-center">
                <span className="inline-flex items-center gap-2 text-sm font-black text-slate-800"><Clock3 className="size-4 text-slate-400" aria-hidden="true" />{session.time.split(" - ")[0]}</span>
                <span><span className="block text-sm font-black text-slate-950">{session.name}</span><span className="mt-1 block text-xs text-slate-500">{session.coach} · {session.room}</span></span>
                <span className="flex items-center justify-between gap-3 sm:justify-end"><span className="text-xs font-semibold text-slate-500">{session.present}/{session.expected}</span><StatusPill tone={session.status === "En cours" ? "green" : session.status === "À finaliser" ? "amber" : "blue"}>{session.status}</StatusPill></span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4"><p className="text-xs font-black uppercase tracking-[0.13em] text-red-600">Priorités</p><h2 className="mt-1 text-lg font-black text-slate-950">À traiter</h2></div>
          <div className="grid gap-3 p-4">
            {notifications.map((notification, index) => (
              <button key={notification.title} type="button" onClick={() => onNavigate(index === 0 ? "attendance" : index === 1 ? "payments" : "members")} className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50/40">
                <span className={notification.tone === "danger" ? "mt-0.5 size-2.5 shrink-0 rounded-full bg-red-500" : notification.tone === "warning" ? "mt-0.5 size-2.5 shrink-0 rounded-full bg-amber-500" : "mt-0.5 size-2.5 shrink-0 rounded-full bg-blue-500"} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-black text-slate-900">{notification.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{notification.detail}</span></span>
                <ChevronRight className="mt-1 size-4 shrink-0 text-slate-400" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-[0.13em] text-blue-600">Tendance</p><h2 className="mt-1 text-lg font-black text-slate-950">Encaissements 7 jours</h2></div><p className="text-xl font-black text-slate-950">2 145,00 TND</p></div>
          <div className="mt-7 flex h-44 items-end gap-3 border-b border-slate-200 px-1 sm:gap-5">
            {bars.map((height, index) => (
              <div key={index} className="flex h-full flex-1 items-end"><div className="w-full rounded-t bg-blue-600" style={{ height: `${height}%` }} /></div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 text-center text-[10px] font-semibold text-slate-400"><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Lun</span><span>Mar</span><span>Auj.</span></div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="text-lg font-black text-slate-950">Derniers paiements</h2><button type="button" onClick={() => onNavigate("payments")} className="text-sm font-bold text-blue-600">Voir tout</button></div>
          <div className="divide-y divide-slate-100">
            {payments.slice(0, 4).map((payment) => (
              <div key={payment.receipt} className="flex items-center justify-between gap-3 px-5 py-3.5"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{payment.member}</p><p className="mt-1 text-xs text-slate-400">{payment.method} · {payment.time}</p></div><p className="shrink-0 text-sm font-black text-emerald-700">{payment.amount}</p></div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function AttendanceView() {
  return (
    <div className="space-y-5">
      <PageHeading eyebrow="Présences" title="Pointage du jour" description="Ouvrez une séance, vérifiez les élèves attendus et finalisez le pointage." action={<StatusPill tone="blue">3 séances</StatusPill>} />
      <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="grid content-start gap-3">
          {sessions.map((session, index) => (
            <article key={session.name} className={index === 1 ? "rounded-lg border-2 border-blue-600 bg-white p-5 shadow-sm" : "rounded-lg border border-slate-200 bg-white p-5 shadow-sm"}>
              <div className="flex items-center justify-between gap-3"><span className="text-sm font-black text-slate-950">{session.time}</span><StatusPill tone={session.status === "En cours" ? "green" : session.status === "À finaliser" ? "amber" : "blue"}>{session.status}</StatusPill></div>
              <h2 className="mt-4 text-lg font-black text-slate-950">{session.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{session.coach} · {session.room}</p>
              <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500"><span>{session.present}/{session.expected} pointés</span><span>{session.expected - session.present} restants</span></div>
            </article>
          ))}
        </div>
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5"><p className="text-xs font-black uppercase tracking-[0.13em] text-blue-600">Séance sélectionnée</p><h2 className="mt-2 text-xl font-black text-slate-950">Kick-boxing adultes</h2><p className="mt-1 text-sm text-slate-500">18:15 - 19:30 · Salle 2</p></div>
          <div className="divide-y divide-slate-100">
            {members.slice(0, 4).map((member, index) => (
              <div key={member.name} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3"><span className="inline-flex size-9 items-center justify-center rounded-lg bg-blue-50 text-xs font-black text-blue-700">{member.initials}</span><div><p className="text-sm font-black text-slate-950">{member.name}</p><p className="mt-1 text-xs text-slate-500">{member.plan} · {member.balance}</p></div></div>
                <div className="flex gap-2"><button type="button" className={index === 3 ? "h-9 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-600" : "h-9 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white"}>{index === 3 ? "Absent" : "Présent"}</button><button type="button" className="h-9 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-500">Modifier</button></div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">Les actions de cette démonstration ne sont pas enregistrées.</div>
        </section>
      </div>
    </div>
  );
}

function MembersView() {
  return (
    <div className="space-y-5">
      <PageHeading eyebrow="Élèves" title="Membres" description="Recherchez un dossier, consultez son abonnement et voyez immédiatement la prochaine action." action={<button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white"><UserPlus className="size-4" aria-hidden="true" />Inscrire</button>} />
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row">
        <label className="flex h-11 flex-1 items-center gap-3 rounded-lg border border-slate-200 px-3 text-slate-400"><Search className="size-4" aria-hidden="true" /><span className="text-sm">Nom, téléphone ou groupe...</span></label>
        <button type="button" className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700">Tous les statuts</button>
      </div>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.3fr_1fr_1fr_0.8fr_auto] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-slate-500 md:grid"><span>Membre</span><span>Groupe</span><span>Formule</span><span>Solde</span><span>Statut</span></div>
        <div className="divide-y divide-slate-100">
          {members.map((member) => (
            <div key={member.name} className="grid gap-4 px-5 py-4 md:grid-cols-[1.3fr_1fr_1fr_0.8fr_auto] md:items-center">
              <div className="flex items-center gap-3"><span className="inline-flex size-10 items-center justify-center rounded-lg bg-blue-50 text-xs font-black text-blue-700">{member.initials}</span><div><p className="text-sm font-black text-slate-950">{member.name}</p><p className="mt-1 text-xs text-slate-400 md:hidden">{member.group}</p></div></div>
              <p className="hidden text-sm text-slate-600 md:block">{member.group}</p><p className="text-sm font-semibold text-slate-700">{member.plan}</p><p className={member.balance === "0,00 TND" ? "text-sm font-black text-emerald-700" : "text-sm font-black text-red-700"}>{member.balance}</p><StatusPill tone={member.status === "Actif" ? "green" : member.status === "À renouveler" ? "amber" : "red"}>{member.status}</StatusPill>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PaymentsView() {
  return (
    <div className="space-y-5">
      <PageHeading eyebrow="Caisse" title="Encaisser" description="Retrouvez le membre, saisissez le paiement et remettez un reçu vérifiable." action={<StatusPill tone="amber">6 soldes à suivre</StatusPill>} />
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Nouveau paiement</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-slate-700">Membre<div className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 font-normal text-slate-400"><Search className="size-4" />Rechercher un membre...</div></label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">Montant<div className="flex h-11 items-center justify-between rounded-lg border border-slate-200 px-3 font-black text-slate-900"><span>0,00</span><span className="text-slate-400">TND</span></div></label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">Mode<div className="flex h-11 items-center rounded-lg border border-slate-200 px-3 font-normal text-slate-600">Espèces</div></label>
            <button type="button" className="mt-2 h-11 rounded-lg bg-blue-600 text-sm font-bold text-white">Enregistrer le paiement</button>
            <p className="text-xs leading-5 text-slate-400">Mode lecture seule : aucun paiement réel ne sera créé.</p>
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-xs font-black uppercase tracking-[0.13em] text-blue-600">Aujourd&apos;hui</p><h2 className="mt-1 text-lg font-black text-slate-950">Historique caisse</h2></div><p className="text-xl font-black text-emerald-700">420,00 TND</p></div>
          <div className="divide-y divide-slate-100">
            {payments.map((payment) => (
              <div key={payment.receipt} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-sm font-black text-slate-950">{payment.member}</p><p className="mt-1 text-xs text-slate-400">{payment.time} · {payment.method} · {payment.receipt}</p></div><div className="flex items-center justify-between gap-4 sm:justify-end"><p className="text-sm font-black text-emerald-700">{payment.amount}</p><ReceiptText className="size-4 text-slate-400" aria-hidden="true" /></div></div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function PlanningView() {
  return (
    <div className="space-y-5">
      <PageHeading eyebrow="Planning semaine" title="Cours du 17 au 22 août" description="Les jours d'ouverture, groupes, coachs et créneaux utiles dans une seule vue." action={<StatusPill tone="green">10 séances planifiées</StatusPill>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {week.map((day) => (
          <section key={day.day} className="min-h-[230px] rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="border-b border-slate-100 pb-3"><p className="text-sm font-black text-slate-950">{day.day}</p><p className="mt-1 text-xs text-slate-400">{day.date} · {day.sessions.length} cours</p></div>
            <div className="mt-3 grid gap-2">
              {day.sessions.map((session) => (
                <div key={`${session.time}-${session.title}`} className="rounded-lg border border-blue-100 bg-blue-50 p-3"><p className="text-xs font-black text-blue-700">{session.time}</p><p className="mt-2 text-sm font-black leading-5 text-slate-900">{session.title}</p><p className="mt-2 text-[11px] text-slate-500">Salle 1 · Planifiée</p></div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function DemoWorkspace() {
  const [activeView, setActiveView] = useState<DemoView>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const navigate = (view: DemoView) => {
    setActiveView(view);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#F6F9FF] text-slate-950">
      <div className="sticky top-0 z-[60] flex min-h-10 items-center justify-between gap-3 bg-slate-950 px-4 py-2 text-xs text-white sm:px-6">
        <p className="font-semibold"><span className="font-black text-sky-300">Mode démonstration</span><span className="hidden sm:inline"> · Données fictives, aucune modification enregistrée</span></p>
        <Link href="/accueil" className="inline-flex shrink-0 items-center gap-1.5 font-bold text-white hover:text-sky-300"><ArrowLeft className="size-3.5" aria-hidden="true" />Retour au site</Link>
      </div>

      <div className="grid min-h-[calc(100vh-40px)] lg:grid-cols-[240px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-slate-200 px-5 py-4"><Link href="/accueil" className="relative block h-11 w-[150px]"><Image src="/we-discipline/navbar-logo.svg" alt="We Discipline" fill sizes="150px" className="object-contain object-left" unoptimized /></Link></div>
          <div className="px-4 py-5"><p className="px-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Club démonstration</p><p className="mt-2 px-3 text-sm font-black text-slate-950">Académie Atlas</p></div>
          <nav className="grid gap-1 px-3" aria-label="Navigation de la démo">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button key={item.id} type="button" onClick={() => navigate(item.id)} className={active ? "flex h-11 items-center gap-3 rounded-lg bg-blue-50 px-3 text-sm font-bold text-blue-700" : "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-950"}>
                  <Icon className="size-4.5" aria-hidden="true" /><span className="flex-1 text-left">{item.label}</span>{item.count ? <span className={active ? "rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] text-white" : "rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"}>{item.count}</span> : null}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-slate-200 p-4"><div className="rounded-lg bg-slate-950 p-4 text-white"><p className="text-xs font-black">Prêt pour votre club ?</p><p className="mt-2 text-xs leading-5 text-slate-300">Créez un espace sans toucher à cette démo.</p><Link href="/signup" className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-md bg-blue-600 text-xs font-bold">Créer mon espace</Link></div></div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-10 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex items-center gap-3"><button type="button" className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 lg:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="Ouvrir le menu"><Menu className="size-5" /></button><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Espace réception</p><p className="text-sm font-black text-slate-950">{navItems.find((item) => item.id === activeView)?.label}</p></div></div>
            <div className="relative flex items-center gap-2">
              <DemoBadge />
              <button type="button" className="relative inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white" onClick={() => setNotificationsOpen((value) => !value)} aria-label="Notifications" aria-expanded={notificationsOpen}><Bell className="size-4.5" /><span className="absolute -right-1 -top-1 inline-flex size-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white">3</span></button>
              <span className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold sm:flex"><span className="inline-flex size-7 items-center justify-center rounded-md bg-blue-600 text-xs text-white">A</span>Admin démo</span>
              {notificationsOpen ? (
                <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-32px))] rounded-lg border border-slate-200 bg-white p-3 shadow-[0_20px_60px_rgba(15,23,42,0.2)]">
                  <div className="flex items-center justify-between px-2 pb-3"><p className="text-sm font-black text-slate-950">Notifications</p><button type="button" onClick={() => setNotificationsOpen(false)} className="text-slate-400" aria-label="Fermer"><X className="size-4" /></button></div>
                  <div className="grid gap-2">{notifications.map((notification) => <div key={notification.title} className="rounded-lg border border-slate-200 p-3"><p className="text-sm font-black text-slate-900">{notification.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{notification.detail}</p></div>)}</div>
                </div>
              ) : null}
            </div>
          </header>

          <main className="mx-auto max-w-[1500px] p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
            {activeView === "dashboard" ? <DashboardView onNavigate={navigate} /> : null}
            {activeView === "attendance" ? <AttendanceView /> : null}
            {activeView === "members" ? <MembersView /> : null}
            {activeView === "payments" ? <PaymentsView /> : null}
            {activeView === "planning" ? <PlanningView /> : null}
          </main>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden"><button type="button" className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileMenuOpen(false)} aria-label="Fermer le menu" /><aside className="absolute inset-y-0 left-0 w-[min(310px,88vw)] bg-white p-4 shadow-xl"><div className="flex items-center justify-between border-b border-slate-200 pb-4"><Image src="/we-discipline/navbar-logo.svg" alt="We Discipline" width={150} height={44} unoptimized /><button type="button" className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200" onClick={() => setMobileMenuOpen(false)} aria-label="Fermer"><X className="size-5" /></button></div><nav className="mt-5 grid gap-2">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => navigate(item.id)} className={activeView === item.id ? "flex h-12 items-center gap-3 rounded-lg bg-blue-50 px-3 text-sm font-bold text-blue-700" : "flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-700"}><Icon className="size-5" />{item.label}</button>; })}</nav></aside></div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-slate-200 bg-white px-1 pb-[max(6px,env(safe-area-inset-bottom))] pt-1 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] lg:hidden" aria-label="Navigation mobile de la démo">
        {navItems.map((item) => { const Icon = item.icon; const active = activeView === item.id; return <button key={item.id} type="button" onClick={() => navigate(item.id)} className={active ? "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg bg-blue-50 text-[10px] font-bold text-blue-700" : "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-semibold text-slate-500"}><Icon className="size-4.5" aria-hidden="true" />{item.label}</button>; })}
      </nav>
    </div>
  );
}
