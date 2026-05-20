"use client";

import { useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Check, Users, X, XIcon } from "lucide-react";
import type { SessionCardData } from "./session-card";

const MARK_ALL_MAX = 8;

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
  onCheckIn: (
    memberId: string,
    status: string,
    overrideReason?: string,
  ) => void | boolean | Promise<void | boolean>;
  onClose: () => void;
  loadingId: string | null;
  message: string | null;
}) {
  const [modalMember, setModalMember] = useState<{ memberId: string; name: string; status: string } | null>(null);
  const [reason, setReason] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  function hasSub(mid: string) {
    return activeSubscriptionMemberIds.includes(`${session.id}_${mid}`);
  }

  function getAtt(mid: string) {
    return session.attendances.find((a) => a.memberId === mid);
  }

  const present = session.attendances.filter((a) => a.status === "PRESENT").length;
  const absent = session.attendances.filter((a) => a.status === "ABSENT").length;
  const override = session.attendances.filter((a) => a.status === "OVERRIDE").length;
  const total = session.group.members.length;
  const checked = present + absent + override;
  const remaining = total - checked;

  const unmarkedWithSub = session.group.members.filter((gm) => {
    const att = getAtt(gm.memberId);
    return hasSub(gm.memberId) && att?.status !== "PRESENT";
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !modalMember) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, modalMember]);

  async function handleClick(mid: string, status: string) {
    if (!hasSub(mid) && status !== "OVERRIDE") {
      const m = session.group.members.find((gm) => gm.memberId === mid);
      if (m) {
        setModalMember({
          memberId: mid,
          name: `${m.member.firstName} ${m.member.lastName}`,
          status,
        });
        return;
      }
    }
    onCheckIn(mid, status);
  }

  async function markAllPresent() {
    if (markingAll || unmarkedWithSub.length === 0) return;
    setMarkingAll(true);
    for (const gm of unmarkedWithSub) {
      const att = getAtt(gm.memberId);
      if (att?.status === "PRESENT") continue;
      const ok = await Promise.resolve(onCheckIn(gm.memberId, "PRESENT"));
      if (ok === false) break;
    }
    setMarkingAll(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-stretch md:justify-end"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={sheetRef}
        className="drawer-sheet drawer-sheet-adaptive flex w-full max-w-lg flex-col rounded-t-2xl bg-[var(--surface)] shadow-xl md:h-full md:max-h-none md:rounded-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="check-in-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-col items-center pt-2 md:hidden">
          <div className="h-1 w-10 rounded-full bg-[var(--border)]" aria-hidden />
        </div>

        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3 pb-3">
          <div className="min-w-0 flex-1">
            <h2 id="check-in-drawer-title" className="truncate text-lg font-semibold text-[var(--foreground)]">
              {session.group.name}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
              {session.startTime} – {session.endTime}
              <span className="text-[var(--border)]"> · </span>
              {session.room}
            </p>
            {session.coach && (
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                Coach {session.coach.firstName} {session.coach.lastName}
              </p>
            )}
            <div className="mt-2.5 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-[var(--success)]/12 px-2.5 py-1 text-xs font-semibold text-[var(--success)]">
                {present} présent{present !== 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center rounded-full bg-[var(--danger)]/12 px-2.5 py-1 text-xs font-semibold text-[var(--danger)]">
                {absent} absent{absent !== 1 ? "s" : ""}
              </span>
              {override > 0 && (
                <span className="inline-flex items-center rounded-full bg-[var(--warning)]/12 px-2.5 py-1 text-xs font-semibold text-[var(--warning)]">
                  {override} except.
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)]">
                {remaining > 0 ? `${remaining} à pointer` : "Complet"} · {total} élève{total !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost shrink-0 rounded-full p-2"
            aria-label="Fermer"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {total <= MARK_ALL_MAX && unmarkedWithSub.length > 0 && (
          <div className="shrink-0 border-b border-[var(--border)] px-4 py-2">
            <button
              type="button"
              onClick={markAllPresent}
              disabled={markingAll || loadingId !== null}
              className="btn btn-primary btn-block-mobile inline-flex w-full min-h-11 items-center justify-center gap-2 text-sm"
            >
              <Users className="size-4" />
              {markingAll ? "Pointage en cours…" : `Tous présents (${unmarkedWithSub.length})`}
            </button>
          </div>
        )}

        {message && (
          <div className="shrink-0 px-4 py-2">
            <p className="rounded-lg bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">{message}</p>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="divide-y divide-[var(--border)]">
            {session.group.members.map((gm) => {
              const att = getAtt(gm.memberId);
              const mid = gm.memberId;
              const activeSub = hasSub(mid);
              const rowTone =
                att?.status === "PRESENT"
                  ? "bg-[var(--success)]/[0.06] border-l-4 border-l-[var(--success)]"
                  : att?.status === "ABSENT"
                    ? "bg-[var(--danger)]/[0.06] border-l-4 border-l-[var(--danger)]"
                    : att?.status === "OVERRIDE"
                      ? "bg-[var(--warning)]/[0.06] border-l-4 border-l-[var(--warning)]"
                      : "border-l-4 border-l-transparent";

              return (
                <div key={gm.id} className={`px-4 py-3 transition-colors ${rowTone}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        att?.status === "PRESENT"
                          ? "bg-[var(--success)]/20 text-[var(--success)]"
                          : att?.status === "ABSENT"
                            ? "bg-[var(--danger)]/20 text-[var(--danger)]"
                            : att?.status === "OVERRIDE"
                              ? "bg-[var(--warning)]/20 text-[var(--warning)]"
                              : "bg-[var(--surface-soft)] text-[var(--muted-foreground)]"
                      }`}
                    >
                      {gm.member.firstName[0]}
                      {gm.member.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium text-[var(--foreground)]">
                        {gm.member.firstName} {gm.member.lastName}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {!activeSub && (
                          <span className="text-[0.7rem] font-medium text-[var(--warning)]">Accès restreint</span>
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

                  <div className="mt-3 grid grid-cols-2 gap-2 md:mt-2 md:flex md:justify-end md:gap-2">
                    <button
                      type="button"
                      onClick={() => handleClick(mid, "PRESENT")}
                      disabled={loadingId === mid || markingAll}
                      className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 md:min-h-9 md:min-w-[7rem] md:flex-none md:rounded-lg md:px-3 md:text-xs ${
                        att?.status === "PRESENT"
                          ? "ring-2 ring-[var(--success)] ring-offset-2 ring-offset-[var(--surface)] bg-[var(--success)] text-white"
                          : "bg-[var(--success)] text-white hover:bg-[var(--success)]/90"
                      }`}
                    >
                      <Check className="size-4 shrink-0" />
                      Présent
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClick(mid, "ABSENT")}
                      disabled={loadingId === mid || markingAll}
                      className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 md:min-h-9 md:min-w-[7rem] md:flex-none md:rounded-lg md:px-3 md:text-xs ${
                        att?.status === "ABSENT"
                          ? "ring-2 ring-[var(--danger)] ring-offset-2 ring-offset-[var(--surface)] bg-[var(--danger)] text-white"
                          : "bg-[var(--danger)] text-white hover:bg-[var(--danger)]/90"
                      }`}
                    >
                      <X className="size-4 shrink-0" />
                      Absent
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {modalMember && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4"
          onClick={() => {
            setModalMember(null);
            setReason("");
          }}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg pb-[max(1.25rem,env(safe-area-inset-bottom))] md:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
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
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalMember(null);
                  setReason("");
                }}
                className="btn btn-ghost btn-block-mobile min-h-11"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onCheckIn(modalMember.memberId, "OVERRIDE", reason.trim());
                  setModalMember(null);
                  setReason("");
                }}
                disabled={!reason.trim()}
                className="btn btn-primary btn-block-mobile min-h-11"
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
