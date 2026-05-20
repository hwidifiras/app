"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Check, X, XIcon } from "lucide-react";
import type { SessionCardData } from "./session-card";

export function CheckInDrawer({
  session,
  activeSubscriptionMemberIds,
  onCheckIn,
  onClose,
  loadingId,
  message,
}: {
  session: SessionCardData;
  activeSubscriptionMemberIds: string[];
  onCheckIn: (memberId: string, status: string, overrideReason?: string) => void;
  onClose: () => void;
  loadingId: string | null;
  message: string | null;
}) {
  const [modalMember, setModalMember] = useState<{ memberId: string; name: string; status: string } | null>(null);
  const [reason, setReason] = useState("");

  function hasSub(mid: string) {
    return activeSubscriptionMemberIds.includes(`${session.id}_${mid}`);
  }

  function getAtt(mid: string) {
    return session.attendances.find((a) => a.memberId === mid);
  }

  const present = session.attendances.filter((a) => a.status === "PRESENT").length;
  const absent = session.attendances.filter((a) => a.status === "ABSENT").length;
  const total = session.group.members.length;
  const remaining = total - present - absent;

  async function handleClick(mid: string, status: string) {
    if (!hasSub(mid) && status !== "OVERRIDE") {
      const m = session.group.members.find((gm) => gm.memberId === mid);
      if (m) {
        setModalMember({ memberId: mid, name: `${m.member.firstName} ${m.member.lastName}`, status });
        return;
      }
    }
    onCheckIn(mid, status);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-stretch sm:justify-end">
      <div
        className="flex h-[min(92dvh,100%)] w-full max-h-[92dvh] flex-col rounded-t-2xl bg-[var(--surface)] shadow-xl sm:h-full sm:max-h-none sm:max-w-lg sm:rounded-none"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3 pt-4 sm:pt-3">
          <div className="min-w-0 pr-2">
            <h2 className="truncate text-base font-semibold text-[var(--foreground)]">{session.group.name}</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              {session.startTime} – {session.endTime} · {session.room}
              {session.coach ? ` · Coach: ${session.coach.firstName} ${session.coach.lastName}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost shrink-0 p-1" aria-label="Fermer">
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Counters */}
        <div className="flex shrink-0 gap-4 border-b border-[var(--border)] px-4 py-2 text-xs">
          <span className="font-medium text-[var(--success)]">
            {present} présent{present > 1 ? "s" : ""}
          </span>
          <span className="font-medium text-[var(--danger)]">
            {absent} absent{absent > 1 ? "s" : ""}
          </span>
          <span className="text-[var(--muted-foreground)]">
            {remaining} restant{remaining > 1 ? "s" : ""} / {total}
          </span>
        </div>

        {/* Message */}
        {message && (
          <div className="shrink-0 px-4 py-2">
            <p className="rounded-md bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">{message}</p>
          </div>
        )}

        {/* Member list */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="divide-y divide-[var(--border)]">
            {session.group.members.map((gm) => {
              const att = getAtt(gm.memberId);
              const mid = gm.memberId;
              const activeSub = hasSub(mid);

              return (
                <div
                  key={gm.id}
                  className="flex flex-col gap-3 px-4 py-3 hover:bg-[var(--surface-soft)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:size-8 ${
                        att?.status === "PRESENT"
                          ? "bg-[var(--success)]/15 text-[var(--success)]"
                          : att?.status === "ABSENT"
                            ? "bg-[var(--danger)]/15 text-[var(--danger)]"
                            : "bg-[var(--surface-soft)] text-[var(--muted-foreground)]"
                      }`}
                    >
                      {gm.member.firstName[0]}
                      {gm.member.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {gm.member.firstName} {gm.member.lastName}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!activeSub && (
                          <span className="text-[0.65rem] font-medium text-[var(--warning)]">
                            Accès restreint
                          </span>
                        )}
                        {att && (
                          <StatusBadge
                            variant={
                              att.status === "PRESENT" ? "success" : att.status === "ABSENT" ? "danger" : "warning"
                            }
                          >
                            {att.status === "PRESENT" ? "Présent" : att.status === "ABSENT" ? "Absent" : "Exception"}
                          </StatusBadge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:gap-2">
                    <button
                      onClick={() => handleClick(mid, "PRESENT")}
                      disabled={loadingId === mid}
                      className="inline-flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl bg-[var(--success)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--success)]/90 active:scale-[0.98] disabled:opacity-50 sm:min-h-0 sm:rounded-lg sm:px-3 sm:py-2 sm:text-xs"
                      title="Présent"
                    >
                      <Check className="size-4" />
                      Présent
                    </button>
                    <button
                      onClick={() => handleClick(mid, "ABSENT")}
                      disabled={loadingId === mid}
                      className="inline-flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl bg-[var(--danger)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--danger)]/90 active:scale-[0.98] disabled:opacity-50 sm:min-h-0 sm:rounded-lg sm:px-3 sm:py-2 sm:text-xs"
                      title="Absent"
                    >
                      <X className="size-4" />
                      Absent
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Override modal */}
      {modalMember && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg sm:rounded-xl">
            <h3 className="text-base font-semibold text-[var(--foreground)]">Passage exceptionnel</h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {modalMember.name} n&apos;est pas en règle (abonnement, quota, impayé, ou sport non inclus). Un motif est
              obligatoire.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motif du passage exceptionnel..."
              className="field mt-3 min-h-[80px]"
            />
            <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <button
                onClick={() => {
                  setModalMember(null);
                  setReason("");
                }}
                className="btn btn-ghost btn-block-mobile"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  onCheckIn(modalMember.memberId, "OVERRIDE", reason.trim());
                  setModalMember(null);
                  setReason("");
                }}
                disabled={!reason.trim()}
                className="btn btn-primary btn-block-mobile"
              >
                Valider passage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
