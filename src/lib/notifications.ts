import { formatMoney } from "@/lib/subscription-billing";
import { utcDateOnlyForTimeZone } from "@/lib/dates";

export type NotificationSeverity = "critical" | "warning" | "info";
export type NotificationKind = "PAYMENT_DUE" | "SUBSCRIPTION_EXPIRING";

export type NotificationSubscriptionRow = {
  id: string;
  amount: number;
  endDate: Date | null;
  member: {
    id: string;
    firstName: string;
    lastName: string;
  };
  plan: {
    name: string;
  };
  payments: Array<{ amount: number }>;
};

export type AppNotification = {
  key: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  description: string;
  href: string;
  occurredAt: string;
  read: boolean;
};

type NotificationOptions = {
  now?: Date;
  includePayments: boolean;
  includeExpirations: boolean;
  debtThresholdCents: number;
  readKeys?: Set<string>;
};

function daysUntil(date: Date, now: Date) {
  return Math.round(
    (utcDateOnlyForTimeZone(date).getTime() - utcDateOnlyForTimeZone(now).getTime()) /
      86_400_000,
  );
}

function expiryStage(daysRemaining: number) {
  if (daysRemaining <= 0) return "today";
  if (daysRemaining <= 3) return "three-days";
  return "seven-days";
}

function memberName(row: NotificationSubscriptionRow) {
  return `${row.member.firstName} ${row.member.lastName}`.trim();
}

export function buildNotifications(
  subscriptions: NotificationSubscriptionRow[],
  options: NotificationOptions,
): AppNotification[] {
  const now = options.now ?? new Date();
  const readKeys = options.readKeys ?? new Set<string>();
  const notifications: AppNotification[] = [];

  for (const subscription of subscriptions) {
    const name = memberName(subscription);

    if (options.includePayments) {
      const paid = subscription.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const outstanding = Math.max(0, subscription.amount - paid);
      if (outstanding > 0 && (options.debtThresholdCents <= 0 || outstanding >= options.debtThresholdCents)) {
        const key = `payment-due:${subscription.id}:${outstanding}`;
        notifications.push({
          key,
          kind: "PAYMENT_DUE",
          severity: paid > 0 ? "warning" : "critical",
          title: paid > 0 ? "Paiement partiel à compléter" : "Paiement à encaisser",
          description: `${name} · reste ${formatMoney(outstanding)} sur ${subscription.plan.name}`,
          href: `/payments/new?memberId=${subscription.member.id}`,
          occurredAt: now.toISOString(),
          read: readKeys.has(key),
        });
      }
    }

    if (options.includeExpirations && subscription.endDate) {
      const daysRemaining = daysUntil(subscription.endDate, now);
      if (daysRemaining >= 0 && daysRemaining <= 7) {
        const stage = expiryStage(daysRemaining);
        const key = `subscription-expiry:${subscription.id}:${stage}`;
        const timing =
          daysRemaining === 0
            ? "expire aujourd'hui"
            : `expire dans ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""}`;
        notifications.push({
          key,
          kind: "SUBSCRIPTION_EXPIRING",
          severity: daysRemaining === 0 ? "critical" : daysRemaining <= 3 ? "warning" : "info",
          title: daysRemaining === 0 ? "Abonnement à renouveler aujourd'hui" : "Abonnement bientôt expiré",
          description: `${name} · ${subscription.plan.name} ${timing}`,
          href: `/subscriptions/${subscription.id}/edit`,
          occurredAt: subscription.endDate.toISOString(),
          read: readKeys.has(key),
        });
      }
    }
  }

  const severityOrder: Record<NotificationSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return notifications.sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return a.description.localeCompare(b.description, "fr");
  });
}
