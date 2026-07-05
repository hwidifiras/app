import type { DashboardTone } from "@/components/dashboard/dashboard-ui";

export type PaymentEntryTypeValue = "PAYMENT" | "CORRECTION" | "REVERSAL";

export type DashboardPayment = {
  id: string;
  amount: number;
  entryType: PaymentEntryTypeValue;
  paymentMethod: string | null;
  paymentDate: Date;
};

export type CashMethodStat = {
  method: string;
  label: string;
  amount: number;
  count: number;
  tone: DashboardTone;
};

export type CashTrendDay = {
  key: string;
  label: string;
  amount: number;
  isToday: boolean;
};

export type RecentMemberPreview = {
  id: string;
  name: string;
  initials: string;
  planName: string;
  joinedAt: Date;
  status: string;
};

export function sumPaymentAmounts(payments: Array<{ amount: number }>) {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatTrendLabel(date: Date) {
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
  });
}

export function memberInitials(firstName: string, lastName: string) {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "M";
}

export function formatPaymentMethodLabel(method: string | null) {
  const normalized = method?.trim().toUpperCase();

  switch (normalized) {
    case "CASH":
      return "Espèces";
    case "CARD":
      return "Carte";
    case "BANK_TRANSFER":
    case "TRANSFER":
      return "Virement";
    case "CHECK":
      return "Chèque";
    case "REPRISE_EXCEL":
    case "REPRISE_PAPIER":
      return "Reprise";
    case "UNKNOWN":
      return "Non renseigné";
    default:
      return method?.trim() || "Non renseigné";
  }
}

export function paymentMethodTone(method: string): DashboardTone {
  switch (method.toUpperCase()) {
    case "CASH":
      return "green";
    case "CARD":
      return "blue";
    case "CHECK":
      return "amber";
    default:
      return "slate";
  }
}

export function buildCashTrend(payments: DashboardPayment[], trendStart: Date, today: Date): CashTrendDay[] {
  const totalsByDay = new Map<string, number>();

  for (const payment of payments) {
    const key = dateKey(payment.paymentDate);
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + payment.amount);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(trendStart);
    date.setUTCDate(date.getUTCDate() + index);
    const key = dateKey(date);

    return {
      key,
      label: formatTrendLabel(date),
      amount: totalsByDay.get(key) ?? 0,
      isToday: key === dateKey(today),
    };
  });
}
