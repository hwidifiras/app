"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Mail, Wallet } from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import type { DashboardDebtReminderRow } from "@/lib/payment-reminders";
import { PAYMENT_REMINDER_COOLDOWN_DAYS } from "@/lib/payment-reminders";
import { formatMoney } from "@/lib/subscription-billing";

export function DashboardDebtsSection({
  debts,
  emailConfigured,
}: {
  debts: DashboardDebtReminderRow[];
  emailConfigured: boolean;
}) {
  const [rows, setRows] = useState(debts);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const remindableCount = useMemo(
    () => rows.filter((row) => row.email && !row.reminderBlocked).length,
    [rows],
  );

  function toggleExpand(memberId: string) {
    setExpandedIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
  }

  function applyReminderResults(
    results: Array<{ memberId: string; status: string }>,
  ) {
    const sentIds = new Set(
      results.filter((result) => result.status === "sent").map((result) => result.memberId),
    );

    if (sentIds.size > 0) {
      const nowIso = new Date().toISOString();
      setRows((current) =>
        current.map((row) =>
          sentIds.has(row.memberId)
            ? { ...row, lastReminderAt: nowIso, reminderBlocked: true }
            : row,
        ),
      );
    }
  }

  async function sendReminders(memberIds: string[]) {
    const response = await fetch("/api/payments/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds }),
    });
    const payload = (await response.json()) as {
      data?: {
        results: Array<{ memberId: string; status: string; reason?: string }>;
        summary: { sent: number; skipped: number; failed: number };
      };
      error?: string;
    };

    if (!response.ok) {
      setMessage(payload.error ?? "Erreur lors de l'envoi des rappels");
      return null;
    }

    return payload.data ?? null;
  }

  async function remindOne(memberId: string) {
    setLoadingMemberId(memberId);
    setMessage(null);

    const data = await sendReminders([memberId]);
    setLoadingMemberId(null);

    if (!data) return;

    applyReminderResults(data.results);
    setMessage(
      data.summary.sent > 0
        ? "Rappel email envoyé."
        : "Rappel non envoyé (email manquant, cooldown ou configuration Resend).",
    );
  }

  async function remindAllEligible() {
    const memberIds = rows.filter((row) => row.email && !row.reminderBlocked).map((row) => row.memberId);
    if (memberIds.length === 0) {
      setMessage("Aucun membre éligible pour un rappel email.");
      return;
    }

    setBatchLoading(true);
    setMessage(null);

    const data = await sendReminders(memberIds);
    setBatchLoading(false);

    if (!data) return;

    applyReminderResults(data.results);
    setMessage(
      `${data.summary.sent} rappel(s) envoyé(s), ${data.summary.skipped} ignoré(s), ${data.summary.failed} échec(s).`,
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted-foreground)]">
          {emailConfigured
            ? `Rappels email via Resend · cooldown ${PAYMENT_REMINDER_COOLDOWN_DAYS} jours`
            : "Rappels email indisponibles — configurez RESEND_API_KEY et PASSWORD_RESET_FROM."}
        </p>
        {emailConfigured && remindableCount > 0 ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm inline-flex items-center gap-1.5"
            disabled={batchLoading}
            onClick={() => {
              void remindAllEligible();
            }}
          >
            <Mail className="size-3.5" />
            {batchLoading ? "Envoi…" : `Relancer ${remindableCount} par email`}
          </button>
        ) : null}
      </div>

      <FeedbackMessage message={message} className="mb-3" />

      <div className="data-table overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Membre</th>
              <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Contact</th>
              <th className="px-4 py-3 text-right font-semibold">Montant</th>
              <th className="hidden px-4 py-3 text-right font-semibold md:table-cell">Abos</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
              <th className="px-2 py-3 text-center md:hidden" aria-hidden="true">
                <span className="sr-only">Détails</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((item) => {
              const expanded = expandedIds.includes(item.memberId);
              const canRemind = emailConfigured && Boolean(item.email) && !item.reminderBlocked;
              const remindTitle = !item.email
                ? "Email manquant sur la fiche membre"
                : item.reminderBlocked
                  ? `Rappel déjà envoyé récemment (< ${PAYMENT_REMINDER_COOLDOWN_DAYS} j)`
                  : "Envoyer un rappel email";

              return (
                <tr
                  key={item.memberId}
                  className={`mobile-collapsible-row transition-colors hover:bg-[var(--surface-soft)] ${expanded ? "is-expanded" : ""}`}
                >
                  <td className="data-table-primary px-4 py-3 font-medium text-[var(--foreground)]" data-label="Membre">
                    <Link href={`/members/${item.memberId}`} className="hover:text-[var(--primary)] hover:underline">
                      {item.memberName}
                    </Link>
                    {item.partialPaid ? (
                      <span className="ml-2 inline-flex rounded-full bg-[var(--warning)]/15 px-2 py-0.5 text-[0.65rem] font-medium text-[var(--warning)]">
                        Partiel
                      </span>
                    ) : null}
                  </td>
                  <td className="mobile-detail-cell px-4 py-3" data-label="Contact">
                    <p>{item.phone}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{item.email ?? "Pas d'email"}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--danger)]" data-label="Montant">
                    {formatMoney(item.totalDebt)}
                  </td>
                  <td className="mobile-detail-cell px-4 py-3 text-right" data-label="Abos">
                    {item.subscriptions}
                  </td>
                  <td className="px-4 py-3 text-right" data-label="Actions">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Link
                        href={`/payments/new?memberId=${item.memberId}`}
                        className="btn btn-ghost btn-sm inline-flex items-center gap-1.5"
                      >
                        <Wallet className="size-3.5" />
                        Encaisser
                      </Link>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                        disabled={!canRemind || loadingMemberId === item.memberId || batchLoading}
                        title={remindTitle}
                        onClick={() => {
                          void remindOne(item.memberId);
                        }}
                      >
                        <Mail className="size-3.5" />
                        {loadingMemberId === item.memberId ? "…" : "Rappel"}
                      </button>
                    </div>
                  </td>
                  <td className="mobile-toggle-cell px-4 py-3 text-center md:hidden">
                    <button
                      type="button"
                      className="mobile-card-toggle"
                      onClick={() => toggleExpand(item.memberId)}
                      aria-expanded={expanded}
                    >
                      {expanded ? "Voir moins" : "Voir plus"}
                      <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
