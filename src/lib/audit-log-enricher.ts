import { prisma } from "@/lib/prisma";

import type { AuditDetailRow, AuditDetailSection, AuditLogRow, AuditPresentation } from "@/lib/audit-log-presenter";
import { presentAuditLog } from "@/lib/audit-log-presenter";

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

function parseIdList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
    } catch {
      /* ignore */
    }
  }
  return [];
}

function formatEurosFromCents(cents: unknown): string | null {
  if (typeof cents !== "number" || Number.isNaN(cents)) return null;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatDateFr(value: unknown): string {
  if (typeof value !== "string") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function memberLabel(m: { firstName: string; lastName: string }): string {
  return `${m.firstName} ${m.lastName}`.trim();
}

async function loadMembers(ids: string[]) {
  if (ids.length === 0) return new Map<string, { firstName: string; lastName: string; phone: string }>();
  const rows = await prisma.member.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  return new Map(rows.map((m) => [m.id, m]));
}

const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Présent",
  ABSENT: "Absent",
  OVERRIDE: "Exception",
  PLANNED: "Planifiée",
  RESCHEDULED: "Reportée",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
};

const OFFER_KIND_LABELS: Record<string, string> = {
  FAMILY_BUNDLE: "Forfait famille",
  SECOND_DISCIPLINE: "2e discipline",
  PERCENT_OFF: "Réduction %",
  FIXED_OFF: "Montant fixe",
};

export async function enrichAuditLogPresentation(
  log: AuditLogRow,
  base?: AuditPresentation,
): Promise<AuditPresentation> {
  const presentation = base ?? presentAuditLog(log);
  const details = parseDetails(log.details);
  const sections: AuditDetailSection[] = [];

  switch (log.action) {
    case "ENROLLMENT_APPLIED": {
      const rows: AuditDetailRow[] = [];
      const inlineLines = details?.lines;
      if (Array.isArray(inlineLines) && inlineLines.length > 0) {
        const list: string[] = [];
        for (const line of inlineLines) {
          if (!line || typeof line !== "object") continue;
          const l = line as Record<string, unknown>;
          const name = typeof l.memberName === "string" ? l.memberName : "Élève";
          const group = typeof l.groupName === "string" ? l.groupName : "";
          const plan = typeof l.planName === "string" ? l.planName : "";
          const sport = typeof l.sportName === "string" ? l.sportName : "";
          const amount = formatEurosFromCents(l.finalAmountCents);
          const discount =
            typeof l.discountCents === "number" && l.discountCents > 0
              ? ` (−${formatEurosFromCents(l.discountCents)})`
              : "";
          list.push(
            `${name} — ${group || sport}${plan ? ` · ${plan}` : ""}${amount ? ` · ${amount}${discount}` : ""}`,
          );
        }
        if (list.length) rows.push({ label: "Inscriptions", list });
      } else {
        const memberIds = parseIdList(details?.memberIds);
        const members = await loadMembers(memberIds);
        const subIds = parseIdList(details?.subscriptionIds);
        const subs =
          subIds.length > 0
            ? await prisma.memberSubscription.findMany({
                where: { id: { in: subIds } },
                include: {
                  member: { select: { firstName: true, lastName: true } },
                  plan: { select: { name: true, sport: { select: { name: true } } } },
                },
              })
            : [];

        if (subs.length > 0) {
          rows.push({
            label: "Inscriptions",
            list: subs.map((s) => {
              const name = memberLabel(s.member);
              return `${name} — ${s.plan.sport.name} · ${s.plan.name}`;
            }),
          });
        } else if (members.size > 0) {
          rows.push({
            label: "Élèves",
            list: [...members.values()].map((m) => `${memberLabel(m)} · ${m.phone}`),
          });
        }
      }

      if (details?.offerName && typeof details.offerName === "string") {
        rows.push({ label: "Offre appliquée", value: details.offerName });
      } else if (details?.offerId && typeof details.offerId === "string") {
        const offer = await prisma.offer.findUnique({
          where: { id: details.offerId },
          select: { name: true, kind: true },
        });
        if (offer) {
          rows.push({
            label: "Offre appliquée",
            value: `${offer.name} (${OFFER_KIND_LABELS[offer.kind] ?? offer.kind})`,
          });
        }
      }

      const total = formatEurosFromCents(details?.totalFinalCents);
      if (total) rows.push({ label: "Total encaissé (devis)", value: total });

      if (rows.length) sections.push({ title: "Détail de l'inscription", rows });
      break;
    }

    case "MEMBER_SUBSCRIPTION_CREATED":
    case "MEMBER_SUBSCRIPTION_UPDATED": {
      const rows: AuditDetailRow[] = [];
      const subId = log.entityType === "MemberSubscription" ? log.entityId : null;
      const sub = subId
        ? await prisma.memberSubscription.findUnique({
            where: { id: subId },
            include: {
              member: { select: { firstName: true, lastName: true, phone: true } },
              plan: { select: { name: true, sport: { select: { name: true } } } },
            },
          })
        : null;

      if (sub) {
        rows.push({ label: "Élève", value: `${memberLabel(sub.member)} · ${sub.member.phone}` });
        rows.push({ label: "Formule", value: `${sub.plan.sport.name} — ${sub.plan.name}` });
        const amount = formatEurosFromCents(sub.amount);
        if (amount) rows.push({ label: "Montant abonnement", value: amount });
        if (details?.startDate) rows.push({ label: "Début", value: formatDateFr(details.startDate) });
        if (details?.source) rows.push({ label: "Origine", value: String(details.source) });
      } else if (details?.memberId) {
        const m = await prisma.member.findUnique({
          where: { id: String(details.memberId) },
          select: { firstName: true, lastName: true, phone: true },
        });
        if (m) rows.push({ label: "Élève", value: `${memberLabel(m)} · ${m.phone}` });
      }

      if (log.action === "MEMBER_SUBSCRIPTION_UPDATED" && details?.payload) {
        rows.push({ label: "Champs modifiés", value: "Voir historique technique" });
      }

      if (rows.length) sections.push({ title: "Abonnement", rows });
      break;
    }

    case "PAYMENT_CREATED":
    case "PAYMENT_UPDATED":
    case "PAYMENT_DELETED": {
      const rows: AuditDetailRow[] = [];
      const paymentId = log.entityType === "Payment" ? log.entityId : null;
      const payment = paymentId
        ? await prisma.payment.findUnique({
            where: { id: paymentId },
            include: {
              memberSubscription: {
                include: {
                  member: { select: { firstName: true, lastName: true } },
                  plan: { select: { name: true } },
                },
              },
            },
          })
        : null;

      const amount = formatEurosFromCents(details?.amount ?? payment?.amount);
      if (amount) rows.push({ label: "Montant", value: amount });

      if (payment?.memberSubscription) {
        const m = payment.memberSubscription.member;
        rows.push({
          label: "Élève",
          value: `${memberLabel(m)} — abonnement ${payment.memberSubscription.plan.name}`,
        });
      } else if (details?.memberId) {
        const m = await prisma.member.findUnique({
          where: { id: String(details.memberId) },
          select: { firstName: true, lastName: true },
        });
        if (m) rows.push({ label: "Élève", value: memberLabel(m) });
      }

      if (rows.length) sections.push({ title: "Paiement", rows });
      break;
    }

    case "ATTENDANCE_CREATED":
    case "ATTENDANCE_UPDATED":
    case "ATTENDANCE_DELETED": {
      const rows: AuditDetailRow[] = [];
      const attId = log.entityType === "Attendance" ? log.entityId : null;
      const att = attId
        ? await prisma.attendance.findUnique({
            where: { id: attId },
            include: {
              member: { select: { firstName: true, lastName: true } },
              session: {
                include: {
                  group: { select: { name: true } },
                  coach: { select: { firstName: true, lastName: true } },
                },
              },
            },
          })
        : null;

      const memberId = (details?.memberId as string) ?? att?.memberId;
      const sessionId = (details?.sessionId as string) ?? att?.sessionId;

      if (att?.member) {
        rows.push({ label: "Élève", value: memberLabel(att.member) });
      } else if (memberId) {
        const m = await prisma.member.findUnique({
          where: { id: memberId },
          select: { firstName: true, lastName: true },
        });
        if (m) rows.push({ label: "Élève", value: memberLabel(m) });
      }

      const session =
        att?.session ??
        (sessionId
          ? await prisma.session.findUnique({
              where: { id: sessionId },
              include: {
                group: { select: { name: true } },
                coach: { select: { firstName: true, lastName: true } },
              },
            })
          : null);

      if (session) {
        rows.push({
          label: "Séance",
          value: `${session.group.name} · ${formatDateFr(session.sessionDate.toISOString())} · ${session.startTime}–${session.endTime}`,
        });
        if (session.coach) {
          rows.push({
            label: "Coach",
            value: `${session.coach.firstName} ${session.coach.lastName}`,
          });
        }
      }

      const status = (details?.status as string) ?? (details?.newStatus as string) ?? att?.status;
      if (status) rows.push({ label: "Statut", value: STATUS_LABELS[status] ?? status });

      if (log.action === "ATTENDANCE_UPDATED" && details?.oldStatus && details?.newStatus) {
        rows.push({
          label: "Changement",
          value: `${STATUS_LABELS[String(details.oldStatus)] ?? details.oldStatus} → ${STATUS_LABELS[String(details.newStatus)] ?? details.newStatus}`,
        });
      }

      if (details?.overrideReason) {
        rows.push({ label: "Motif exception", value: String(details.overrideReason) });
      }

      if (rows.length) sections.push({ title: "Pointage", rows });
      break;
    }

    case "SESSION_POSTPONED": {
      const rows: AuditDetailRow[] = [];
      const session = await prisma.session.findUnique({
        where: { id: log.entityId },
        include: { group: { select: { name: true } } },
      });
      if (session) rows.push({ label: "Cours", value: session.group.name });
      if (details?.fromDate) {
        rows.push({
          label: "Ancien créneau",
          value: `${formatDateFr(details.fromDate)} · ${details.fromTime ?? "?"}`,
        });
      }
      if (details?.toDate) {
        rows.push({
          label: "Nouveau créneau",
          value: `${formatDateFr(details.toDate)} · ${details.toTime ?? "?"}`,
        });
      }
      if (details?.reason) rows.push({ label: "Motif", value: String(details.reason) });
      if (rows.length) sections.push({ title: "Report de séance", rows });
      break;
    }

    case "MEMBER_ARCHIVED":
    case "MEMBER_DELETED":
    case "MEMBER_UPDATED": {
      const rows: AuditDetailRow[] = [];
      const member = await prisma.member.findUnique({
        where: { id: log.entityId },
        select: { firstName: true, lastName: true, phone: true, email: true },
      });
      if (member) {
        rows.push({ label: "Élève", value: `${memberLabel(member)} · ${member.phone}` });
        if (member.email) rows.push({ label: "Email", value: member.email });
      }
      if (log.action === "MEMBER_UPDATED" && Array.isArray(details?.fields)) {
        rows.push({
          label: "Champs modifiés",
          value: (details.fields as string[]).join(", "),
        });
      }
      if (log.action === "MEMBER_ARCHIVED" && details?.archivedAt) {
        rows.push({ label: "Archivé le", value: formatDateFr(details.archivedAt) });
      }
      if (rows.length) sections.push({ title: "Élève", rows });
      break;
    }

    case "USER_CREATED":
    case "USER_UPDATED":
    case "USER_REGISTERED":
    case "PASSWORD_RESET_SENT_BY_ADMIN":
    case "PASSWORD_RESET_REQUESTED":
    case "PASSWORD_RESET_COMPLETED":
    case "ACCOUNT_UPDATED": {
      const rows: AuditDetailRow[] = [];
      const user =
        log.entityType === "User"
          ? await prisma.user.findUnique({
              where: { id: log.entityId },
              select: { name: true, email: true, role: true },
            })
          : null;

      if (user) {
        rows.push({ label: "Compte", value: `${user.name.trim() || user.email} · ${user.email}` });
        rows.push({ label: "Rôle", value: user.role === "ADMIN" ? "Administrateur" : "Équipe" });
      }

      if (details?.email) rows.push({ label: "Email", value: String(details.email) });
      if (details?.permissions && Array.isArray(details.permissions)) {
        rows.push({
          label: "Permissions",
          list: details.permissions.map(String),
        });
      }
      if (log.action === "PASSWORD_RESET_SENT_BY_ADMIN" || log.action === "PASSWORD_RESET_REQUESTED") {
        const delivered = details?.delivered === true;
        rows.push({
          label: "Email envoyé",
          value: delivered ? "Oui" : "Non (mode test ou Resend non configuré)",
        });
      }
      if (log.action === "ACCOUNT_UPDATED") {
        const changes: string[] = [];
        if (details?.nameChanged) changes.push("Nom");
        if (details?.emailChanged) changes.push("Email");
        if (details?.passwordChanged) changes.push("Mot de passe");
        if (changes.length) rows.push({ label: "Modifications", value: changes.join(", ") });
      }

      if (rows.length) sections.push({ title: "Compte utilisateur", rows });
      break;
    }

    case "OFFER_CREATED": {
      const rows: AuditDetailRow[] = [];
      if (details?.name) rows.push({ label: "Nom de l'offre", value: String(details.name) });
      if (details?.kind) {
        rows.push({
          label: "Type",
          value: OFFER_KIND_LABELS[String(details.kind)] ?? String(details.kind),
        });
      }
      if (rows.length) sections.push({ title: "Offre", rows });
      break;
    }

    default:
      break;
  }

  if (sections.length === 0 && presentation.detailSections.length > 0) {
    sections.push(...presentation.detailSections);
  }

  if (sections.length === 0 && details) {
    const generic = presentation.detailSections;
    if (generic.length) sections.push(...generic);
  }

  const entityRow = await buildEntityRow(log);
  if (entityRow) {
    const last = sections[sections.length - 1];
    if (last) {
      last.rows.push(entityRow);
    } else {
      sections.push({ title: "Référence", rows: [entityRow] });
    }
  }

  const context = buildEnrichedContext(log, details, sections) ?? presentation.context;

  return {
    ...presentation,
    context,
    hasDetailPage: sections.some((s) => s.rows.length > 0),
    detailSections: sections.filter((s) => s.rows.length > 0),
  };
}

async function buildEntityRow(log: AuditLogRow): Promise<AuditDetailRow | null> {
  const labels: Record<string, string> = {
    Member: "Fiche élève",
    MemberSubscription: "Abonnement",
    Payment: "Paiement",
    Attendance: "Pointage",
    Session: "Séance",
    User: "Utilisateur",
    Offer: "Offre",
    ClubSettings: "Paramètres club",
    Enrollment: "Inscription",
  };
  const label = labels[log.entityType];
  if (!label) return null;
  return { label: "Référence système", value: `${label} · ${log.entityId}` };
}

function buildEnrichedContext(
  log: AuditLogRow,
  details: Record<string, unknown> | null,
  sections: AuditDetailSection[],
): string | null {
  const firstList = sections[0]?.rows.find((r) => r.list?.length)?.list;
  if (firstList?.length === 1) return firstList[0];
  if (firstList && firstList.length > 1) return `${firstList.length} élément(s)`;

  const firstValue = sections[0]?.rows[0]?.value;
  if (firstValue) return firstValue;

  if (log.action === "ENROLLMENT_APPLIED" && details?.lines && Array.isArray(details.lines)) {
    const lines = details.lines as unknown[];
    if (lines.length === 1) {
      const l = lines[0] as Record<string, unknown>;
      if (typeof l.memberName === "string") return l.memberName;
    }
    return `${lines.length} élève(s)`;
  }

  return null;
}

/** Batch-enrich list context (lightweight) */
export async function enrichAuditLogContexts(
  logs: AuditLogRow[],
  presentations: Map<string, AuditPresentation>,
): Promise<Map<string, AuditPresentation>> {
  const out = new Map(presentations);

  for (const log of logs) {
    const base = presentations.get(log.id);
    if (!base || base.context) continue;

    if (log.action === "ENROLLMENT_APPLIED") {
      const details = parseDetails(log.details);
      const lines = details?.lines;
      if (Array.isArray(lines) && lines.length > 0) {
        const names = lines
          .map((l) => (l && typeof l === "object" ? (l as Record<string, unknown>).memberName : null))
          .filter((n): n is string => typeof n === "string");
        if (names.length === 1) {
          out.set(log.id, { ...base, context: names[0] });
          continue;
        }
        if (names.length > 1) {
          out.set(log.id, { ...base, context: names.slice(0, 2).join(", ") + (names.length > 2 ? "…" : "") });
          continue;
        }
      }
      const ids = parseIdList(details?.memberIds);
      if (ids.length > 0) {
        const members = await prisma.member.findMany({
          where: { id: { in: ids.slice(0, 3) } },
          select: { firstName: true, lastName: true },
        });
        if (members.length === 1) {
          out.set(log.id, { ...base, context: memberLabel(members[0]) });
        } else if (members.length > 1) {
          out.set(log.id, {
            ...base,
            context: members.map(memberLabel).join(", ") + (ids.length > 3 ? "…" : ""),
          });
        }
      }
    }
  }

  return out;
}
