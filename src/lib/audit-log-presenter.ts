export type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  details: string | null;
  createdAt: Date;
};

export type AuditDetailSection = {
  title: string;
  rows: Array<{ label: string; value: string }>;
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
  OFFER_CREATED: "Offre promotionnelle créée",
  ENROLLMENT_APPLIED: "Inscription enregistrée",
  CLUB_SETTINGS_UPDATED: "Règles du club modifiées",
  PASSWORD_RESET_COMPLETED: "Mot de passe réinitialisé",
  PASSWORD_RESET_REQUESTED: "Demande de réinitialisation du mot de passe",
  PASSWORD_RESET_SENT_BY_ADMIN: "Lien de réinitialisation envoyé par un admin",
  MEMBER_SUBSCRIPTION_CREATED: "Abonnement créé",
  MEMBER_SUBSCRIPTION_UPDATED: "Abonnement modifié",
  PAYMENT_CREATED: "Paiement enregistré",
  PAYMENT_UPDATED: "Paiement modifié",
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
  ATTENDANCE_DELETED: "Présence supprimée",
  SESSION_POSTPONED: "Séance reportée",
  ADMIN_BOOTSTRAPPED: "Premier administrateur créé",
};

const CLUB_FIELD_LABELS: Record<string, string> = {
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

function formatEurosFromCents(cents: unknown): string | null {
  if (typeof cents !== "number" || Number.isNaN(cents)) return null;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatBool(value: unknown): string {
  if (value === true) return "Oui";
  if (value === false) return "Non";
  return String(value ?? "—");
}

function formatClubValue(key: string, value: unknown): string {
  if (key === "debtAlertThresholdCents") return formatEurosFromCents(value) ?? "0 €";
  if (typeof value === "boolean") return formatBool(value);
  if (value === "" || value === null || value === undefined) return "—";
  return String(value);
}

function buildClubSettingsSections(details: Record<string, unknown>): AuditDetailSection[] {
  const before = details.before as Record<string, unknown> | undefined;
  const after = details.after as Record<string, unknown> | undefined;
  if (!before || !after) return [];

  const rows: Array<{ label: string; value: string }> = [];
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
  const rows: Array<{ label: string; value: string }> = [];
  const memberIds = details.memberIds;
  const subscriptionIds = details.subscriptionIds;

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

  if (Array.isArray(subscriptionIds)) {
    rows.push({ label: "Abonnements", value: `${subscriptionIds.length} créé(s)` });
  }

  if (details.offerId && typeof details.offerId === "string") {
    rows.push({ label: "Offre appliquée", value: "Oui" });
  }

  return rows.length ? [{ title: "Résumé de l'inscription", rows }] : [];
}

function buildGenericSections(details: Record<string, unknown>): AuditDetailSection[] {
  const rows: Array<{ label: string; value: string }> = [];

  for (const [key, value] of Object.entries(details)) {
    if (key === "before" || key === "after") continue;
    let display: string;
    if (key === "amount" && typeof value === "number") {
      display = formatEurosFromCents(value) ?? String(value);
    } else if (typeof value === "object") {
      display = JSON.stringify(value);
    } else {
      display = String(value);
    }
    const label =
      {
        amount: "Montant",
        memberSubscriptionId: "Abonnement",
        memberId: "Élève",
        archivedAt: "Date d'archivage",
        status: "Statut",
      }[key] ?? key;
    rows.push({ label, value: display });
  }

  return rows.length ? [{ title: "Informations complémentaires", rows }] : [];
}

function buildContext(action: string, details: Record<string, unknown> | null): string | null {
  if (!details) return null;

  if (action === "PAYMENT_CREATED" || action === "PAYMENT_UPDATED") {
    const amount = formatEurosFromCents(details.amount);
    if (amount) return amount;
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
  const summary = ACTION_LABELS[log.action] ?? log.action.replaceAll("_", " ").toLowerCase();
  const context = buildContext(log.action, details);

  let detailSections: AuditDetailSection[] = [];

  if (log.action === "CLUB_SETTINGS_UPDATED" && details) {
    detailSections = buildClubSettingsSections(details);
  } else if (log.action === "ENROLLMENT_APPLIED" && details) {
    detailSections = buildEnrollmentSections(details);
  } else if (details) {
    detailSections = buildGenericSections(details);
  }

  const hasDetailPage = detailSections.some((s) => s.rows.length > 0);

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
