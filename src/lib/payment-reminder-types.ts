export const PAYMENT_REMINDER_COOLDOWN_DAYS = 7;

export type DashboardDebtReminderRow = {
  memberId: string;
  memberName: string;
  phone: string;
  totalDebt: number;
  subscriptions: number;
  partialPaid: boolean;
  email: string | null;
  lastReminderAt: string | null;
  reminderBlocked: boolean;
};
