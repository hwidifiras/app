"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";
import { CalendarClock, Check, CheckCircle2, Eye, LockOpen, MapPin, RotateCcw, UserRound, Users, X, XIcon } from "lucide-react";

import { UndoButton } from "@/components/ui/undo-button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";
import { formatMoney } from "@/lib/money";
import type { AttendanceQueueKind, SessionCardData } from "./session-card";

const MARK_ALL_MAX = 8;
const DESKTOP_QUERY = "(min-width: 1280px)";

function subscribeToDesktopChange(callback: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

export function CheckInDrawer({
  open,
  session,
  queueKind,
  readOnly = false,
  activeSubscriptionMemberIds,
  partialPaymentMemberIds,
  partialPaymentDebtsCents,
  onCheckIn,
  onClose,
  loadingId,
  message,
  canUndo = false,
  undoCount = 0,
  undoLoading = false,
  onUndo,
  finalizeLoading = false,
  onFinalize,
  onReopen,
  postponeHref,
}: {
  open: boolean;
  session: SessionCardData;
  queueKind: AttendanceQueueKind;
  readOnly?: boolean;
  activeSubscriptionMemberIds: string[];
  partialPaymentMemberIds: string[];
  partialPaymentDebtsCents: Record<string, number>;
  onCheckIn: (
    memberId: string,
    status: string,
    overrideReason?: string,
    overrideKind?: "STANDARD" | "RECOVERY",
  ) => void | boolean | Promise<void | boolean>;
  onClose: () => void;
  loadingId: string | null;
  message: string | null;
  canUndo?: boolean;
  undoCount?: number;
  undoLoading?: boolean;
  onUndo?: () => void | Promise<void>;
  finalizeLoading?: boolean;
  onFinalize?: () => void | Promise<void>;
  onReopen?: () => void | Promise<void>;
  postponeHref: string;
}) {
  const [modalMember, setModalMember] = useState<{ memberId: string; name: string; status: string } | null>(null);
  const [reason, setReason] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const overrideTitleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const overrideReasonRef = useRef<HTMLTextAreaElement>(null);
  const isDesktop = useSyncExternalStore(subscribeToDesktopChange, getDesktopSnapshot, () => false);
  const sheetRef = useAccessibleDialog<HTMLDivElement>({
    open: open && !isDesktop,
    onClose,
    closeOnEscape: !modalMember,
    initialFocusRef: closeButtonRef,
    trapFocus: !modalMember,
  });
  const overrideDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: Boolean(modalMember),
    onClose: () => {
      setModalMember(null);
      setReason("");
    },
    initialFocusRef: overrideReasonRef,
  });

  function hasSub(mid: string) {
    return activeSubscriptionMemberIds.includes(`${session.id}_${mid}`);
  }

  function hasPartialDebt(mid: string) {
    return partialPaymentMemberIds.includes(`${session.id}_${mid}`);
  }

  function remainingDebtLabel(mid: string) {
    const cents = partialPaymentDebtsCents[`${session.id}_${mid}`];
    if (!cents || cents <= 0) return null;
    return `Solde ${formatMoney(cents)}`;
  }

  function getAtt(mid: string) {
    return session.attendances.find((a) => a.memberId === mid);
  }

  const expectedMemberIds = new Set(session.group.members.map((member) => member.memberId));
  const expectedAttendances = session.attendances.filter((attendance) =>
    expectedMemberIds.has(attendance.memberId),
  );
  const present = expectedAttendances.filter((a) => a.status === "PRESENT").length;
  const absent = expectedAttendances.filter((a) => a.status === "ABSENT").length;
  const override = expectedAttendances.filter((a) => a.status === "OVERRIDE").length;
  const total = session.group.members.length;
  const checked = present + absent + override;
  const remaining = total - checked;
  const isFinalized = session.status === "COMPLETED";
  const isUpcoming = queueKind === "NEXT";
  const needsFinalization = session.operationalStatus === "NEEDS_FINALIZATION";
  const hasPaymentPolicyWarning = session.group.members.some(
    (gm) => !hasSub(gm.memberId) || hasPartialDebt(gm.memberId),
  );
  const sessionDateLabel = new Date(session.sessionDate).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const inspectorStatus = readOnly
    ? "Consultation uniquement"
    : queueKind === "NOW"
      ? "Pointage ouvert"
      : queueKind === "REGULARIZE"
        ? "Finalisation requise"
        : queueKind === "DONE"
          ? "Séance finalisée"
          : "Séance à préparer";
  const inspectorStatusDetail = readOnly
    ? "Cette démo montre les données sans autoriser de modification."
    : queueKind === "NOW"
      ? remaining > 0
        ? `${remaining} membre${remaining > 1 ? "s" : ""} reste${remaining > 1 ? "nt" : ""} à pointer.`
        : "Tous les membres ont été traités."
      : queueKind === "REGULARIZE"
        ? remaining > 0
          ? `Complétez encore ${remaining} pointage${remaining > 1 ? "s" : ""}, puis finalisez la séance.`
          : "Tous les membres sont traités. La séance peut être finalisée."
        : queueKind === "DONE"
          ? "Le pointage est verrouillé. Rouvrez la séance pour effectuer une correction."
          : "Le pointage sera disponible lorsque la séance commencera.";

  const unmarkedWithSub = session.group.members.filter((gm) => {
    const att = getAtt(gm.memberId);
    return hasSub(gm.memberId) && !att;
  });

  function statusLabel(status: string, overrideReason?: string | null) {
    if (status === "PRESENT") return "Présent";
    if (status === "ABSENT") return "Absent";
    if (overrideReason?.startsWith("Récupération")) return "Récupération";
    return "Exception";
  }

  async function handleClick(mid: string, status: string) {
    if (readOnly) return;
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
    if (readOnly || markingAll || isUpcoming || unmarkedWithSub.length === 0) return;
    setMarkingAll(true);
    try {
      for (const gm of unmarkedWithSub) {
        const ok = await Promise.resolve(onCheckIn(gm.memberId, "PRESENT"));
        if (ok === false) break;
      }
    } finally {
      setMarkingAll(false);
    }
  }

  if (!open && !isDesktop) return null;

  return (
    <div
      className="attendance-inspector-layer"
      onClick={isDesktop ? undefined : onClose}
      role="presentation"
    >
      <div
        ref={sheetRef}
        id="attendance-roster-panel"
        className="attendance-inspector drawer-sheet drawer-sheet-adaptive"
        role={isDesktop ? "region" : "dialog"}
        aria-modal={isDesktop ? undefined : true}
        aria-labelledby="check-in-drawer-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="attendance-inspector-handle">
          <div className="h-1 w-10 rounded-full bg-[var(--border)]" aria-hidden />
        </div>

        <header className="attendance-inspector-header">
          <div className="attendance-inspector-title-row">
            <div className="min-w-0 flex-1">
              <p className={`attendance-inspector-eyebrow attendance-inspector-eyebrow-${queueKind.toLowerCase()}`}>
                {inspectorStatus}
              </p>
              <p className="attendance-inspector-time">{session.startTime} – {session.endTime}</p>
              <h2 id="check-in-drawer-title">{session.group.name}</h2>
              <p className="attendance-inspector-date">{sessionDateLabel}</p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="attendance-inspector-close btn btn-ghost min-h-11 min-w-11 shrink-0 p-2"
              aria-label="Retour aux séances"
              title="Retour aux séances"
            >
              <XIcon className="size-5" />
            </button>
          </div>

          <div className={`attendance-inspector-status attendance-inspector-status-${queueKind.toLowerCase()}`}>
            <strong>{inspectorStatus}</strong>
            <span>{inspectorStatusDetail}</span>
          </div>

          <div className="attendance-inspector-facts">
            <span><Users aria-hidden /><strong>{total}</strong> inscrit{total !== 1 ? "s" : ""}</span>
            <span><MapPin aria-hidden />{session.room?.trim() || "Salle à définir"}</span>
            <span><UserRound aria-hidden />{session.coach ? `${session.coach.firstName} ${session.coach.lastName}` : "Coach à définir"}</span>
          </div>

          <div className="attendance-inspector-progress" aria-label={`${checked} membres pointés sur ${total}`}>
            <span><strong>{present}</strong> présents</span>
            <span><strong>{absent}</strong> absents</span>
            {override > 0 ? <span><strong>{override}</strong> exceptions</span> : null}
            <span><strong>{remaining}</strong> restants</span>
          </div>
        </header>

        <div className="attendance-inspector-tools">
          <div className="grid gap-2">
          {readOnly ? (
            <div className="attendance-readonly-notice">
              <Eye aria-hidden />
              <span><strong>Mode démo</strong>Les boutons de pointage et de finalisation sont désactivés.</span>
            </div>
          ) : null}
          {!readOnly && !isFinalized && !isUpcoming && total <= MARK_ALL_MAX && unmarkedWithSub.length > 0 ? (
            <button
              type="button"
              onClick={markAllPresent}
              disabled={markingAll || loadingId !== null}
              className="btn btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2 text-sm"
            >
              <Users className="size-4" />
              {markingAll ? "Pointage en cours…" : `Pointer les restants présents (${unmarkedWithSub.length})`}
            </button>
          ) : <div />}
          {!readOnly && !isUpcoming && hasPaymentPolicyWarning ? (
            <div className="rounded-lg border border-[var(--warning)]/25 bg-[var(--warning)]/10 px-3 py-2 text-xs leading-relaxed text-[var(--foreground)]">
              <strong>Règle de paiement.</strong> Sans abonnement actif ou solde non réglé, le pointage normal peut être bloqué. Utilisez un passage exceptionnel uniquement avec un motif clair.
            </div>
          ) : null}
          </div>
        </div>

        {message ? (
          <div className="shrink-0 px-4 py-2">
            <FeedbackMessage message={message} />
          </div>
        ) : null}

        <div className="attendance-member-scroll sidebar-scroll">
          <div className="attendance-member-list">
            {session.group.members.map((gm) => {
              const att = getAtt(gm.memberId);
              const mid = gm.memberId;
              const activeSub = hasSub(mid);
              const rowTone =
                att?.status === "PRESENT"
                  ? "is-present"
                  : att?.status === "ABSENT"
                    ? "is-absent"
                    : att?.status === "OVERRIDE"
                      ? "is-override"
                      : "";

              return (
                <div key={gm.id} className={`attendance-member-row ${rowTone}`}>
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
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
                          <span className="text-[0.7rem] font-medium text-[var(--warning)]">
                            Pointage normal bloqué · passage exceptionnel requis
                          </span>
                        )}
                        {activeSub && hasPartialDebt(mid) && (
                          <span className="text-[0.7rem] font-medium text-[var(--warning)]">
                            {remainingDebtLabel(mid) ?? "Paiement partiel"}
                          </span>
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

                  <div className="attendance-member-actions">
                    <button
                      type="button"
                      onClick={() => handleClick(mid, "PRESENT")}
                      disabled={readOnly || isFinalized || isUpcoming || loadingId === mid || markingAll}
                      aria-pressed={att?.status === "PRESENT"}
                      className={`attendance-mark-button ${
                        att?.status === "PRESENT"
                          ? "border-[var(--success)] bg-[var(--success)] text-white ring-2 ring-[var(--success)] ring-offset-2 ring-offset-[var(--surface)]"
                          : "border-[var(--success)] bg-[var(--surface)] text-[var(--success)] hover:bg-[var(--success)]/8"
                      }`}
                    >
                      <Check className="size-4 shrink-0" />
                      Présent
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClick(mid, "ABSENT")}
                      disabled={readOnly || isFinalized || isUpcoming || loadingId === mid || markingAll}
                      aria-pressed={att?.status === "ABSENT"}
                      className={`attendance-mark-button ${
                        att?.status === "ABSENT"
                          ? "border-[var(--danger)] bg-[var(--danger)] text-white ring-2 ring-[var(--danger)] ring-offset-2 ring-offset-[var(--surface)]"
                          : "border-[var(--danger)] bg-[var(--surface)] text-[var(--danger)] hover:bg-[var(--danger)]/8"
                      }`}
                    >
                      <X className="size-4 shrink-0" />
                      Absent
                    </button>
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="attendance-inspector-footer">
          {readOnly ? (
            <Link href={postponeHref} prefetch={false} className="btn btn-primary min-h-11 w-full">
              <CalendarClock className="size-4" />
              Ouvrir dans le planning
            </Link>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {isUpcoming ? (
                <Link href={postponeHref} prefetch={false} className="btn btn-primary min-h-11 w-full sm:col-span-2">
                <CalendarClock className="size-4" />
                Ouvrir dans le planning
              </Link>
              ) : isFinalized ? (
                <button
                  type="button"
                  onClick={onReopen}
                  disabled={!onReopen || finalizeLoading}
                  className="btn btn-secondary min-h-11 w-full"
                >
                  <LockOpen className="size-4" />
                  {finalizeLoading ? "Réouverture…" : "Rouvrir pour corriger"}
                </button>
              ) : needsFinalization ? (
                <button
                  type="button"
                  onClick={onFinalize}
                  disabled={!onFinalize || finalizeLoading || remaining > 0}
                  className="btn btn-primary min-h-11 w-full"
                  title={remaining > 0 ? `Il reste ${remaining} membre(s) à pointer` : undefined}
                >
                  <CheckCircle2 className="size-4" />
                  {finalizeLoading
                    ? "Finalisation…"
                    : remaining > 0
                      ? `Finaliser après ${remaining} pointage${remaining > 1 ? "s" : ""}`
                      : "Finaliser la séance"}
                </button>
              ) : (
                <div />
              )}
              <UndoButton
                onClick={onUndo ?? (() => undefined)}
                disabled={isFinalized || isUpcoming || !canUndo || !onUndo || undoLoading || loadingId !== null}
                label={
                  undoLoading
                    ? "Annulation…"
                    : undoCount > 0
                      ? `Annuler le dernier pointage (${undoCount})`
                      : "Aucun pointage à annuler"
                }
                title="Annuler les pointages un par un (Ctrl+Z)"
                className="min-h-11 w-full justify-center"
              />
              {!isUpcoming && !needsFinalization && !isFinalized && checked === 0 ? (
                <Link href={postponeHref} prefetch={false} className="btn btn-secondary min-h-11 w-full">
                  <CalendarClock className="size-4" />
                  Reporter la séance
                </Link>
              ) : !isUpcoming && !needsFinalization && !isFinalized ? (
                <button
                  type="button"
                  disabled
                  className="btn btn-secondary min-h-11 w-full"
                  title="Annulez tous les pointages avant de reporter la séance"
                >
                  <RotateCcw className="size-4" />
                  Reporter après annulation
                </button>
              ) : null}
            </div>
          )}
          {!readOnly && !isUpcoming && !needsFinalization && !isFinalized && checked > 0 ? (
              <p className="mt-2 text-center text-xs text-[var(--muted-foreground)]">
                Annulez les {checked} pointage{checked > 1 ? "s" : ""} un par un pour réactiver le report.
              </p>
            ) : null}
        </div>
      </div>

      {modalMember && !readOnly && (
        <div
          className="mobile-modal-overlay fixed inset-0 z-[60] flex justify-center bg-[var(--overlay)]"
          onClick={(event) => {
            event.stopPropagation();
            setModalMember(null);
            setReason("");
          }}
        >
          <div
            ref={overrideDialogRef}
            className="mobile-modal-panel border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-floating)] md:max-w-sm md:rounded-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby={overrideTitleId}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={overrideTitleId} className="text-base font-semibold text-[var(--foreground)]">Passage exceptionnel</h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {modalMember.name} n&apos;est pas en règle (abonnement, quota, impayé, ou sport non inclus). Un motif est
              obligatoire.
            </p>
            <textarea
              ref={overrideReasonRef}
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
                onClick={async () => {
                  const accepted = await Promise.resolve(
                    onCheckIn(modalMember.memberId, "OVERRIDE", reason.trim()),
                  );
                  if (accepted !== false) {
                    setModalMember(null);
                    setReason("");
                  }
                }}
                disabled={!reason.trim() || loadingId === modalMember.memberId}
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
