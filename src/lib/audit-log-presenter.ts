import { formatMoney } from "@/lib/money";
import { policyForAuditAction } from "@/lib/recovery-policy";

export type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  details: string | null;
  createdAt: Date;
};

export type AuditDetailRow = {
  label: string;
  value?: string;
  /** Puces pour listes (élèves, permissions, etc.) */
  list?: string[];
};

export type AuditDetailSection = {
  title: string;
  rows: AuditDetailRow[];
};

export type AuditPresentation = {
  /** Short French title for the list */
  summary: string;
  /** Optional second line (context) */
  context: string | null;
  /** French labels for search */
  searchText: string;
  hasDetailPage: boolean;
  detailSections: AuditDetailSection[];
};

const ACTION_LABELS: Record<string, string> = {
  ENROLLMENT_VOIDED: "Inscription annulee",
  ENROLLMENT_REVERTED: "Inscription annulee",
  DATA_IMPORT_APPLIED: "Import applique",
  DATA_IMPORT_ROLLED_BACK: "Import annule",
  GROUP_MEMBER_CREATED: "Affectation groupe creee",
  GROUP_MEMBER_UPDATED: "Affectation groupe modifiee",
  GROUP_MEMBER_CLOSED: "Affectation groupe fermee",
  GROUP_MEMBERS_ASSIGNED: "Affectations groupe ajoutees",
  GROUP_MEMBERS_CLOSED: "Affectations groupe fermees",
  HOUSEHOLD_CREATED: "Foyer cree",
  HOUSEHOLD_MEMBER_ADDED: "Membre ajoute au foyer",
  GROUP_SCHEDULE_UPDATED: "Horaire de groupe modifie",
  GROUP_SCHEDULE_CLOSED: "Horaire de groupe ferme",
  GROUP_DEACTIVATED: "Groupe desactive",
  GROUP_COACH_PROPAGATED: "Coach propage aux seances",
  SCHEDULE_TEMPLATE_CREATED: "Modele horaire cree",
  SCHEDULE_TEMPLATE_UPDATED: "Modele horaire modifie",
  SCHEDULE_TEMPLATE_APPLIED: "Modele horaire applique",
  SCHEDULE_TEMPLATE_ARCHIVED: "Modele horaire archive",
  SESSIONS_GENERATED: "Seances generees",
  SPORT_CREATED: "Discipline creee",
  SPORT_UPDATED: "Discipline modifiee",
  SPORT_DEACTIVATED: "Discipline desactivee",
  COACH_CREATED: "Coach cree",
  COACH_UPDATED: "Coach modifie",
  COACH_DEACTIVATED: "Coach desactive",
  SUBSCRIPTION_PLAN_CREATED: "Formule creee",
  SUBSCRIPTION_PLAN_UPDATED: "Formule modifiee",
  SUBSCRIPTION_PLAN_DEACTIVATED: "Formule desactivee",
  PAYMENT_REMINDER_SENT: "Relance paiement envoyee",
  OFFER_CREATED: "Offre promotionnelle créée",
  OFFER_DEACTIVATED: "Offre promotionnelle désactivée",
  ENROLLMENT_APPLIED: "Inscription enregistrée",
  CLUB_SETTINGS_UPDATED: "Règles du club modifiées",
  PASSWORD_RESET_COMPLETED: "Mot de passe réinitialisé",
  PASSWORD_RESET_REQUESTED: "Demande de réinitialisation du mot de passe",
  PASSWORD_RESET_SENT_BY_ADMIN: "Lien de réinitialisation envoyé par un admin",
  MEMBER_SUBSCRIPTION_CREATED: "Abonnement créé",
  MEMBER_SUBSCRIPTION_UPDATED: "Abonnement modifié",
  MEMBER_SUBSCRIPTION_CANCELLED: "Abonnement résilié",
  PAYMENT_CREATED: "Paiement enregistré",
  PAYMENT_UPDATED: "Paiement modifié",
  PAYMENT_CORRECTED: "Correction de paiement",
  PAYMENT_REVERSED: "Paiement annulé",
  PAYMENT_DELETED: "Paiement supprimé",
  MEMBER_ARCHIVED: "Élève archivé (résiliation)",
  MEMBER_UPDATED: "Fiche élève modifiée",
  MEMBER_DELETED: "Élève supprimé définitivement",
  USER_CREATED: "Compte utilisateur créé",
  USER_UPDATED: "Compte utilisateur modifié",
  USER_REGISTERED: "Nouveau compte inscrit",
  ACCOUNT_UPDATED: "Mon compte mis à jour",
  ATTENDANCE_CREATED: "Présence enregistrée",
  ATTENDANCE_UPDATED: "Présence modifiée",
  ATTENDANCE_DELETED: "Pointage annulé",
  SESSION_UPDATED: "Séance modifiée",
  SESSION_CANCELLED: "Séance annulée",
  SESSION_COMPLETED: "Séance finalisée",
  SESSION_REOPENED: "Séance rouverte",
  SESSION_POSTPONED: "Séance reportée",
  COACH_SPORT_OVERRIDE_USED: "Exception coach utilisée",
  RECEIPT_ISSUED: "Reçu émis",
  RECEIPT_VOIDED: "Reçu annulé",
  RECEIPT_EMAIL_SENT: "Reçu envoyé par email",
  RECEIPT_EMAIL_FAILED: "Échec envoi reçu email",
  ADMIN_BOOTSTRAPPED: "Premier administrateur créé",
};

const CLUB_FIELD_LABELS: Record<string, string> = {
  absentConsumesSession: "Absence consomme une seance",
  allowSameRoomConcurrentGroups: "Deux groupes dans la meme salle",
  allowCoachConcurrentSameRoomQualified: "Coach multi-groupes meme salle",
  allowPublicRegister: "Inscription publique",
  workingDays: "Jours d'ouverture",
  receiptPrefix: "Prefixe recu",
  nextReceiptSequence: "Prochain numero recu",
  receiptFooter: "Texte bas de recu",
  receiptEmailDefault: "Email recu automatique",
  receiptPrintDefault: "Impression recu proposee",
  receiptLegalName: "Nom légal reçu",
  receiptTaxId: "Identifiant fiscal reçu",
  clubName: "Nom du club",
  clubLogoUrl: "Logo",
  clubAddress: "Adresse",
  clubPhone: "Téléphone",
  allowCheckInWithPartialPayment: "Pointage avec paiement partiel",
  allowCheckInWithoutSubscription: "Pointage sans abonnement (exception)",
  maxStaffDiscountPercent: "Réduction staff max. (%)",
  debtAlertThresholdCents: "Seuil dette affichée",
};

function parseDetails(raw: string | null): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function formatMoneyFromCents(cents: unknown): string | null {
  if (typeof cents !== "number" || Number.isNaN(cents)) return null;
  return formatMoney(cents);
}

function formatBool(value: unknown): string {
  if (value === true) return "Oui";
  if (value === false) return "Non";
  return String(value ?? "—");
}

function formatClubValue(key: string, value: unknown): string {
  if (key === "debtAlertThresholdCents") return formatMoneyFromCents(value) ?? formatMoney(0);
  if (typeof value === "boolean") return formatBool(value);
  if (Array.isArray(value)) return value.join(", ");
  if (value === "" || value === null || value === undefined) return "—";
  return String(value);
}

function buildClubSettingsSections(details: Record<string, unknown>): AuditDetailSection[] {
  const before = details.before as Record<string, unknown> | undefined;
  const after = details.after as Record<string, unknown> | undefined;
  if (!before || !after) return [];

  const rows: AuditDetailRow[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    if (key === "updatedAt") continue;
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    const label = CLUB_FIELD_LABELS[key] ?? key;
    rows.push({
      label,
      value: `${formatClubValue(key, b)} → ${formatClubValue(key, a)}`,
    });
  }

  return rows.length ? [{ title: "Modifications", rows }] : [];
}

function buildEnrollmentSections(details: Record<string, unknown>): AuditDetailSection[] {
  const rows: AuditDetailRow[] = [];
  const inlineLines = details.lines;

  if (Array.isArray(inlineLines) && inlineLines.length > 0) {
    const list: string[] = [];
    for (const line of inlineLines) {
      if (!line || typeof line !== "object") continue;
      const l = line as Record<string, unknown>;
      const name = typeof l.memberName === "string" ? l.memberName : "Élève";
      const group = typeof l.groupName === "string" ? l.groupName : "";
      const plan = typeof l.planName === "string" ? l.planName : "";
      const amount = formatMoneyFromCents(l.finalAmountCents);
      list.push(`${name} — ${group}${plan ? ` · ${plan}` : ""}${amount ? ` · ${amount}` : ""}`);
    }
    if (list.length) rows.push({ label: "Inscriptions", list });
  } else {
    const memberIds = details.memberIds;
    if (Array.isArray(memberIds)) {
      rows.push({ label: "Élèves concernés", value: `${memberIds.length} inscription(s)` });
    } else if (typeof memberIds === "string") {
      try {
        const parsed = JSON.parse(memberIds) as unknown[];
        if (Array.isArray(parsed)) {
          rows.push({ label: "Élèves concernés", value: `${parsed.length} inscription(s)` });
        }
      } catch {
        /* ignore */
      }
    }
    if (Array.isArray(details.subscriptionIds)) {
      rows.push({ label: "Abonnements", value: `${details.subscriptionIds.length} créé(s)` });
    }
  }

  if (typeof details.offerName === "string") {
    rows.push({ label: "Offre appliquée", value: details.offerName });
  } else if (details.offerId && typeof details.offerId === "string") {
    rows.push({ label: "Offre appliquée", value: "Oui" });
  }

  const total = formatMoneyFromCents(details.totalFinalCents);
  if (total) rows.push({ label: "Total (devis)", value: total });

  return rows.length ? [{ title: "Résumé de l'inscription", rows }] : [];
}

function buildGenericSections(details: Record<string, unknown>): AuditDetailSection[] {
  const rows: AuditDetailRow[] = [];

  for (const [key, value] of Object.entries(details)) {
    if (key === "before" || key === "after") continue;
    let display: string;
    if (key === "amount" && typeof value === "number") {
      display = formatMoneyFromCents(value) ?? String(value);
    } else if (typeof value === "object") {
      display = JSON.stringify(value);
    } else {
      display = String(value);
    }
    const label =
      {
        amount: "Montant",
        affectedCount: "Séances concernées",
        memberSubscriptionId: "Abonnement",
        memberId: "Élève",
        archivedAt: "Date d'archivage",
        mode: "Mode",
        reason: "Motif",
        scheduleId: "Créneau récurrent",
        status: "Statut",
      }[key] ?? key;
    rows.push({ label, value: display });
  }

  return rows.length ? [{ title: "Informations complémentaires", rows }] : [];
}

function buildContext(action: string, details: Record<string, unknown> | null): string | null {
  if (!details) return null;

  if (action === "PAYMENT_CREATED" || action === "PAYMENT_UPDATED") {
    const amount = formatMoneyFromCents(details.amount);
    if (amount) return amount;
  }

  if (action === "PAYMENT_CORRECTED") {
    const amount = formatMoneyFromCents(details.delta);
    if (amount) return `Correction ${amount}`;
  }

  if (action === "PAYMENT_REVERSED") {
    const amount = formatMoneyFromCents(details.reversedAmount);
    if (amount) return `Annulation ${amount}`;
  }

  if (action === "SESSION_UPDATED" && typeof details.mode === "string") {
    const mode = details.mode === "permanent" ? "Permanent" : "Exception";
    return typeof details.reason === "string" && details.reason.trim()
      ? `${mode} · ${details.reason.trim()}`
      : mode;
  }

  if ((action === "SESSION_COMPLETED" || action === "SESSION_REOPENED") && typeof details.reason === "string") {
    return details.reason;
  }

  if (action === "MEMBER_SUBSCRIPTION_UPDATED" && Array.isArray(details.changedFields)) {
    return `${details.changedFields.length} champ(s) modifié(s)`;
  }

  if ((action === "RECEIPT_EMAIL_SENT" || action === "RECEIPT_EMAIL_FAILED") && typeof details.email === "string") {
    return details.email;
  }

  if (action === "ENROLLMENT_APPLIED") {
    const ids = details.memberIds;
    if (Array.isArray(ids)) return `${ids.length} élève(s)`;
  }

  if (action === "CLUB_SETTINGS_UPDATED") {
    const before = details.before as Record<string, unknown> | undefined;
    const after = details.after as Record<string, unknown> | undefined;
    if (before && after) {
      let changes = 0;
      for (const key of Object.keys(after)) {
        if (key === "updatedAt") continue;
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changes++;
      }
      if (changes > 0) return `${changes} réglage(s) modifié(s)`;
    }
  }

  return null;
}

export function presentAuditLog(log: AuditLogRow): AuditPresentation {
  const details = parseDetails(log.details);
  const recoveryPolicy = policyForAuditAction(log.action);
  const summary = ACTION_LABELS[log.action] ?? recoveryPolicy?.normalUserCopy ?? log.action.replaceAll("_", " ").toLowerCase();
  const context = buildContext(log.action, details);

  let detailSections: AuditDetailSection[] = [];

  if (log.action === "CLUB_SETTINGS_UPDATED" && details) {
    detailSections = buildClubSettingsSections(details);
  } else if (log.action === "ENROLLMENT_APPLIED" && details) {
    detailSections = buildEnrollmentSections(details);
  } else if (details) {
    detailSections = buildGenericSections(details);
  }

  const hasDetailPage = log.action in ACTION_LABELS || Boolean(recoveryPolicy);

  const searchText = [summary, context, log.action, log.entityType, log.entityId].filter(Boolean).join(" ");

  return {
    summary,
    context,
    searchText,
    hasDetailPage,
    detailSections,
  };
}

export function formatAuditDateTime(date: Date): { date: string; time: string } {
  const d = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(date);
  const t = new Intl.DateTimeFormat("fr-FR", { timeStyle: "medium" }).format(date);
  return { date: d, time: t };
}

export function formatAuditUserName(name: string, email: string): string {
  return name.trim() || email;
}

/** Client-side / server filter when user searches in French */
export function auditLogMatchesQuery(
  log: AuditLogRow,
  presentation: AuditPresentation,
  query: string,
): boolean {
  const q = query.toLowerCase();
  return (
    presentation.searchText.toLowerCase().includes(q) ||
    log.action.toLowerCase().includes(q) ||
    (log.details?.toLowerCase().includes(q) ?? false)
  );
}
