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
    overrideKind?: "STANDARD" | "RECOVERY",
  ) => void | boolean | Promise<void | boolean>;
  onClose: () => void;
  loadingId: string | null;
  message: string | null;
}) {
  const [modalMember, setModalMember] = useState<{ memberId: string; name: string; status: string } | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryCandidates, setRecoveryCandidates] = useState<
    Array<{
      memberId: string;
      firstName: string;
      lastName: string;
      phone: string;
      absentGroupName: string;
      absentDate: string;
    }>
  >([]);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMember, setRecoveryMember] = useState<(typeof recoveryCandidates)[number] | null>(null);
  const [recoveryNote, setRecoveryNote] = useState("");
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

  async function openRecoveryPanel() {
    setRecoveryOpen(true);
    setRecoveryLoading(true);
    setRecoveryMember(null);
    setRecoveryNote("");

    try {
      const res = await fetch(`/api/attendances/recovery-candidates?sessionId=${session.id}`);
      const json = await res.json();
      setRecoveryCandidates(Array.isArray(json.data) ? json.data : []);
    } catch {
      setRecoveryCandidates([]);
    } finally {
      setRecoveryLoading(false);
    }
  }

  function statusLabel(status: string, overrideReason?: string | null) {
    if (status === "PRESENT") return "Présent";
    if (status === "ABSENT") return "Absent";
    if (overrideReason?.startsWith("Récupération")) return "Récupération";
    return "Exception";
  }

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
            className="btn btn-ghost min-h-11 min-w-11 shrink-0 rounded-full p-2"
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

        <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            onClick={openRecoveryPanel}
            disabled={loadingId !== null || markingAll}
            className="btn btn-secondary btn-block-mobile min-h-11 text-sm"
          >
            Récupération de séance (autre cours)
          </button>
          <p className="mt-1 text-[0.65rem] text-[var(--muted-foreground)]">
            Pour un élève absent cette semaine sur un cours équivalent (même sport, même type).
          </p>
        </div>

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
                            {statusLabel(att.status, att.overrideReason)}
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
          className="mobile-modal-overlay fixed inset-0 z-[60] flex justify-center bg-black/50"
          onClick={() => {
            setModalMember(null);
            setReason("");
          }}
        >
          <div
            className="mobile-modal-panel border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg md:max-w-sm md:rounded-xl"
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
            <div className="form-actions mt-4 border-t-0 pt-0">
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
      {recoveryOpen && (
        <div
          className="mobile-modal-overlay fixed inset-0 z-[60] flex justify-center bg-black/50"
          onClick={() => {
            setRecoveryOpen(false);
            setRecoveryMember(null);
            setRecoveryNote("");
          }}
        >
          <div
            className="mobile-modal-panel border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg md:max-w-md md:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-[var(--foreground)]">Récupération de séance</h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Élève absent cette semaine sur un cours équivalent — présence sur ce créneau sans consommer une séance
              supplémentaire.
            </p>

            {recoveryLoading ? (
              <p className="mt-4 text-sm text-[var(--muted-foreground)]">Recherche des absences récupérables…</p>
            ) : recoveryCandidates.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted-foreground)]">Aucun élève éligible pour ce cours.</p>
            ) : (
              <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto">
                {recoveryCandidates.map((candidate) => (
                  <li key={candidate.memberId}>
                    <button
                      type="button"
                      onClick={() => setRecoveryMember(candidate)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                        recoveryMember?.memberId === candidate.memberId
                          ? "border-[var(--primary)] bg-[var(--primary)]/5"
                          : "border-[var(--border)] hover:bg-[var(--surface-soft)]"
                      }`}
                    >
                      <span className="font-medium text-[var(--foreground)]">
                        {candidate.firstName} {candidate.lastName}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                        Absent — {candidate.absentGroupName}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {recoveryMember ? (
              <textarea
                value={recoveryNote}
                onChange={(e) => setRecoveryNote(e.target.value)}
                placeholder="Note optionnelle (ex. créneau proposé par le coach)"
                className="field mt-3 min-h-[70px]"
              />
            ) : null}

            <div className="form-actions mt-4 border-t-0 pt-0">
              <button
                type="button"
                onClick={() => {
                  setRecoveryOpen(false);
                  setRecoveryMember(null);
                  setRecoveryNote("");
                }}
                className="btn btn-ghost btn-block-mobile min-h-11"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!recoveryMember) return;
                  onCheckIn(recoveryMember.memberId, "OVERRIDE", recoveryNote.trim(), "RECOVERY");
                  setRecoveryOpen(false);
                  setRecoveryMember(null);
                  setRecoveryNote("");
                }}
                disabled={!recoveryMember}
                className="btn btn-primary btn-block-mobile min-h-11"
              >
                Valider la récupération
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
