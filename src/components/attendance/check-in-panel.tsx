"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Clock, Eye, History } from "lucide-react";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { weekStartIsoForDate } from "@/lib/dates";
import {
  deriveEffectiveAttendanceQueueState,
  tenantClockAt,
  type TenantClock,
} from "@/lib/attendance-queue";
import { useActionHistory } from "@/hooks/use-action-history";
import { useIdempotencyIntent } from "@/hooks/use-idempotency-intent";
import { SessionCard, type AttendanceQueueKind, type SessionCardData } from "./session-card";
import { CheckInDrawer } from "./check-in-drawer";

type TodayData = {
  sessions: SessionCardData[];
  todayIso: string;
  currentMinutes: number;
  appTimeZone: string;
  readOnly: boolean;
  activeSubscriptionMemberIds: string[];
  partialPaymentMemberIds: string[];
  partialPaymentDebtsCents: Record<string, number>;
};

type AttendanceSnapshot = {
  id: string;
  memberId: string;
  status: string;
  overrideReason?: string | null;
};

type AttendanceUndoMeta = {
  sessionId: string;
  memberId: string;
  kind: "create" | "update";
  attendanceId: string;
  previous: AttendanceSnapshot | null;
};

function withPointingProgress(session: SessionCardData): SessionCardData {
  const expectedIds = new Set(session.group.members.map((member) => member.memberId));
  const checkedIds = new Set(
    session.attendances
      .map((attendance) => attendance.memberId)
      .filter((memberId) => expectedIds.has(memberId)),
  );
  const unmarkedCount = Math.max(0, expectedIds.size - checkedIds.size);
  return {
    ...session,
    expectedMemberCount: expectedIds.size,
    checkedMemberCount: checkedIds.size,
    unmarkedCount,
    canFinalize: session.operationalStatus === "NEEDS_FINALIZATION" && unmarkedCount === 0,
  };
}

export function CheckInPanel({
  data,
  initialSessionId,
}: {
  data: TodayData;
  initialSessionId?: string;
}) {
  const [sessions, setSessions] = useState(data.sessions);
  const [tenantClock, setTenantClock] = useState<TenantClock>({
    dayIso: data.todayIso.slice(0, 10),
    minutes: data.currentMinutes,
  });
  const effectiveSessions = useMemo(
    () => sessions.map((session) => ({
      ...session,
      ...deriveEffectiveAttendanceQueueState(session, tenantClock),
    })),
    [sessions, tenantClock],
  );
  const validInitialSessionId = data.sessions.some((session) => session.id === initialSessionId)
    ? initialSessionId
    : undefined;
  const defaultSessionId =
    validInitialSessionId ??
    effectiveSessions.find((session) => session.queueKind === "NOW")?.id ??
    effectiveSessions.find((session) => session.queueKind === "REGULARIZE")?.id ??
    effectiveSessions.find((session) => session.queueKind === "NEXT")?.id ??
    effectiveSessions.at(0)?.id ??
    null;
  const [selectedId, setSelectedId] = useState<string | null>(defaultSessionId);
  const [mobileOpen, setMobileOpen] = useState(Boolean(validInitialSessionId));
  const [overdueOpen, setOverdueOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const { push, undoLast, loading: undoLoading, countInScope } = useActionHistory<AttendanceUndoMeta["sessionId"]>({
    enableKeyboard: true,
  });
  const {
    keyFor: keyForAttendanceIntent,
    complete: completeAttendanceIntent,
  } = useIdempotencyIntent();

  useEffect(() => {
    let intervalId: number | undefined;
    const updateTenantClock = () => {
      setTenantClock(tenantClockAt(new Date(), data.appTimeZone));
    };
    updateTenantClock();

    const now = new Date();
    const millisecondsUntilNextMinute =
      60_000 - (now.getSeconds() * 1_000 + now.getMilliseconds());
    const timeoutId = window.setTimeout(() => {
      updateTenantClock();
      intervalId = window.setInterval(updateTenantClock, 60_000);
    }, millisecondsUntilNextMinute);
    document.addEventListener("visibilitychange", updateTenantClock);
    window.addEventListener("focus", updateTenantClock);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", updateTenantClock);
      window.removeEventListener("focus", updateTenantClock);
    };
  }, [data.appTimeZone]);

  const effectiveSession = selectedId ? effectiveSessions.find((s) => s.id === selectedId) : null;
  const sessionUndoCount = selectedId ? countInScope(selectedId) : 0;
  const nowSessions = effectiveSessions.filter((session) => session.queueKind === "NOW");
  const regularizeSessions = effectiveSessions.filter((session) => session.queueKind === "REGULARIZE");
  const nextSessions = effectiveSessions.filter((session) => session.queueKind === "NEXT");
  const completedSessions = effectiveSessions.filter((session) => session.queueKind === "DONE");
  const effectiveQueueKind: AttendanceQueueKind | null = effectiveSession?.queueKind ?? null;
  const todayLabel = new Date(`${tenantClock.dayIso}T00:00:00.000Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  function selectSession(sessionId: string) {
    setSelectedId(sessionId);
    setMobileOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.set("sessionId", sessionId);
    window.history.replaceState(window.history.state, "", url);
  }

  function closeMobileRoster() {
    setMobileOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById(`attendance-session-${selectedId}`)?.focus();
    });
  }

  const revertAttendance = useCallback((meta: AttendanceUndoMeta) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== meta.sessionId) return session;
        if (meta.kind === "create" || !meta.previous) {
          return withPointingProgress({
            ...session,
            attendances: session.attendances.filter((attendance) => attendance.memberId !== meta.memberId),
          });
        }
        return withPointingProgress({
          ...session,
          attendances: session.attendances.map((attendance) =>
            attendance.memberId === meta.memberId
              ? {
                  id: meta.previous!.id,
                  memberId: meta.previous!.memberId,
                  status: meta.previous!.status,
                  overrideReason: meta.previous!.overrideReason,
                }
              : attendance,
          ),
        });
      }),
    );
  }, []);

  const submitCheckIn = useCallback(
    async (
      sessionId: string,
      mid: string,
      status: string,
      overrideReason?: string,
      overrideKind?: "STANDARD" | "RECOVERY",
    ): Promise<boolean> => {
      if (data.readOnly) {
        setMessage("Mode démo en lecture seule : aucun pointage n’a été modifié.");
        return false;
      }
      setLoadingId(mid);

      const session = sessions.find((s) => s.id === sessionId);
      const existingAtt = session?.attendances.find((a) => a.memberId === mid);
      const idempotencyPayload = existingAtt
        ? {
            attendanceId: existingAtt.id,
            payload: { status, overrideReason: overrideReason?.trim() || null },
          }
        : { sessionId, memberId: mid, status, overrideReason, overrideKind };

      try {
        let res: Response;
        if (existingAtt) {
          res = await fetch("/api/attendances", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": keyForAttendanceIntent(idempotencyPayload),
            },
            body: JSON.stringify({
              attendanceId: existingAtt.id,
              payload: { status, overrideReason: overrideReason?.trim() || null },
            }),
          });
        } else {
          res = await fetch("/api/attendances", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": keyForAttendanceIntent(idempotencyPayload),
            },
            body: JSON.stringify({
              sessionId,
              memberId: mid,
              status,
              overrideReason,
              overrideKind,
              checkedBy: "Réception",
            }),
          });
        }

        const json = await res.json().catch(() => ({})) as {
          data?: { id: string; status: string };
          error?: string;
          warning?: string;
        };
        if (!res.ok) {
          setMessage(json.error ?? "Le pointage n’a pas pu être enregistré.");
          return false;
        }
        completeAttendanceIntent(idempotencyPayload);

        const attendanceId = json.data?.id ?? existingAtt?.id ?? "";
        const nextStatus = json.data?.status ?? status;
        const previous: AttendanceSnapshot | null = existingAtt
          ? {
              id: existingAtt.id,
              memberId: existingAtt.memberId,
              status: existingAtt.status,
              overrideReason: existingAtt.overrideReason ?? null,
            }
          : null;

        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? withPointingProgress({
                  ...s,
                  attendances: [
                    ...s.attendances.filter((a) => a.memberId !== mid),
                    {
                      id: attendanceId,
                      memberId: mid,
                      status: nextStatus,
                      overrideReason: overrideReason?.trim() || existingAtt?.overrideReason || null,
                    },
                  ],
                })
              : s,
          ),
        );

        const meta: AttendanceUndoMeta = {
          sessionId,
          memberId: mid,
          kind: existingAtt ? "update" : "create",
          attendanceId,
          previous,
        };

        push({
          scope: sessionId,
          label: "Pointage",
          undo: async () => {
            try {
              let undoRes: Response;
              let undoPayload: unknown;
              if (meta.kind === "create" || !meta.previous) {
                undoPayload = { attendanceId: meta.attendanceId };
                undoRes = await fetch("/api/attendances", {
                  method: "DELETE",
                  headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": keyForAttendanceIntent(undoPayload),
                  },
                  body: JSON.stringify(undoPayload),
                });
              } else {
                undoPayload = {
                  attendanceId: meta.attendanceId,
                  payload: {
                    status: meta.previous.status,
                    overrideReason: meta.previous.overrideReason,
                  },
                };
                undoRes = await fetch("/api/attendances", {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": keyForAttendanceIntent(undoPayload),
                  },
                  body: JSON.stringify(undoPayload),
                });
              }

              const undoJson = await undoRes.json().catch(() => ({})) as {
                error?: string;
                warning?: string;
              };
              if (!undoRes.ok) {
                setMessage(undoJson.error ?? "Impossible d’annuler le pointage");
                return false;
              }
              completeAttendanceIntent(undoPayload);

              revertAttendance(meta);
              setMessage(undoJson.warning ?? "Dernier pointage annulé");
              return true;
            } catch {
              setMessage("Connexion interrompue. Le pointage n’a pas été annulé.");
              return false;
            }
          },
        });

        setMessage(json.warning ?? "Pointage enregistré");
        return true;
      } catch {
        setMessage("Connexion interrompue. Réessayez : le pointage ne sera pas créé deux fois.");
        return false;
      } finally {
        setLoadingId(null);
      }
    },
    [completeAttendanceIntent, data.readOnly, keyForAttendanceIntent, push, revertAttendance, sessions],
  );

  async function undoLastForSession() {
    if (!selectedId || undoLoading) return;
    if (data.readOnly) {
      setMessage("Mode démo en lecture seule : aucun pointage n’a été modifié.");
      return;
    }
    if (sessionUndoCount > 0) {
      await undoLast(selectedId);
      return;
    }

    const session = sessions.find((item) => item.id === selectedId);
    const latestAttendance = [...(session?.attendances ?? [])].sort((left, right) =>
      (left.checkedAt ?? "").localeCompare(right.checkedAt ?? ""),
    ).at(-1);
    if (!latestAttendance) return;

    setLoadingId(latestAttendance.memberId);
    const requestPayload = { attendanceId: latestAttendance.id };
    try {
      const response = await fetch("/api/attendances", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": keyForAttendanceIntent(requestPayload),
        },
        body: JSON.stringify(requestPayload),
      });
      const result = (await response.json()) as { error?: string; warning?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Impossible d'annuler le dernier pointage");
        return;
      }
      completeAttendanceIntent(requestPayload);

      setSessions((current) =>
        current.map((item) =>
          item.id === selectedId
            ? withPointingProgress({
                ...item,
                attendances: item.attendances.filter(
                  (attendance) => attendance.id !== latestAttendance.id,
                ),
              })
            : item,
        ),
      );
      setMessage(result.warning ?? "Dernier pointage annulé");
    } catch {
      setMessage("Connexion interrompue. Le dernier pointage n'a pas été annulé.");
    } finally {
      setLoadingId(null);
    }
  }

  async function updateFinalization(action: "finalize" | "reopen") {
    if (!selectedId || finalizeLoading) return;
    if (data.readOnly) {
      setMessage("Mode démo en lecture seule : la séance n’a pas été modifiée.");
      return;
    }
    setFinalizeLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/attendances/sessions/${selectedId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason:
            action === "finalize"
              ? "Pointage terminé depuis la réception"
              : "Correction du pointage depuis la réception",
        }),
      });
      const result = (await response.json()) as {
        data?: { status: string };
        error?: string;
      };
      if (!response.ok) {
        setMessage(result.error ?? "Impossible de modifier la finalisation.");
        return;
      }

      setSessions((current) =>
        current.map((session) =>
          session.id === selectedId
            ? {
                ...session,
                status:
                  result.data?.status === "RESCHEDULED"
                    ? "RESCHEDULED"
                    : action === "finalize"
                      ? "COMPLETED"
                      : "PLANNED",
                operationalStatus: action === "finalize" ? "COMPLETED" : "NEEDS_FINALIZATION",
                canFinalize: action === "reopen" && (session.unmarkedCount ?? 0) === 0,
              }
            : session,
        ),
      );
      setMessage(action === "finalize" ? "Séance finalisée." : "Séance rouverte pour correction.");
    } catch {
      setMessage("Connexion interrompue. La séance n'a pas été modifiée.");
    } finally {
      setFinalizeLoading(false);
    }
  }

  if (sessions.length === 0) {
    return (
      <div className="attendance-empty-state">
        <Clock className="mx-auto size-8 text-[var(--muted-foreground)] opacity-50" />
        <h1 className="mt-3 text-xl font-bold text-[var(--foreground)]">Pointage</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">Aucune séance à traiter pour le moment.</p>
        <Link href="/sessions" className="btn btn-secondary mt-5">
          <CalendarDays className="size-4" aria-hidden />
          Voir le planning
        </Link>
      </div>
    );
  }

  return (
    <div className="attendance-workbench">
      <section className="attendance-session-rail" aria-label="File opérationnelle des séances">
        <header className="attendance-rail-header">
          <div>
            <p className="attendance-page-date">{todayLabel}</p>
            <h1>Pointage</h1>
            <p>Traitez la séance en cours, préparez les suivantes et régularisez les retards.</p>
          </div>
          <div className="attendance-header-actions">
            {data.readOnly ? (
              <span className="attendance-readonly-badge"><Eye aria-hidden /> Démo · consultation</span>
            ) : null}
            <Link href="/attendance" className="btn btn-secondary btn-sm" aria-label="Voir l'historique des présences">
              <History className="size-4" aria-hidden />
              Historique
            </Link>
          </div>
        </header>

        <div className="attendance-queue-summary" aria-label="Résumé des séances à traiter">
          <span><strong>{nowSessions.length}</strong> maintenant</span>
          <span><strong>{nextSessions.length}</strong> ensuite</span>
          <span className={regularizeSessions.length > 0 ? "is-warning" : undefined}>
            <strong>{regularizeSessions.length}</strong> à régulariser
          </span>
        </div>

        {message ? <div className="attendance-feedback"><FeedbackMessage message={message} /></div> : null}

        <div className="attendance-session-list">
          <section className="attendance-queue-group attendance-queue-group-now" aria-labelledby="now-sessions-heading">
            <div className="attendance-list-heading">
              <h2 id="now-sessions-heading">Maintenant</h2>
              <span>{nowSessions.length}</span>
            </div>
            {nowSessions.length > 0 ? (
              <div className="attendance-queue-rows">
                {nowSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    kind="NOW"
                    isSelected={selectedId === session.id}
                    readOnly={data.readOnly}
                    onSelect={() => selectSession(session.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="attendance-queue-empty">
                <Clock aria-hidden />
                <span><strong>Aucune séance en cours</strong>La prochaine séance reste accessible ci-dessous.</span>
              </div>
            )}
          </section>

          {nextSessions.length > 0 ? (
            <section className="attendance-queue-group attendance-queue-group-next" aria-labelledby="next-sessions-heading">
              <div className="attendance-list-heading">
                <h2 id="next-sessions-heading">Ensuite</h2>
                <span>{nextSessions.length}</span>
              </div>
              <div className="attendance-queue-rows">
                {nextSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    kind="NEXT"
                    isSelected={selectedId === session.id}
                    readOnly={data.readOnly}
                    onSelect={() => selectSession(session.id)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {regularizeSessions.length > 0 ? (
            <details
              className="attendance-queue-group attendance-queue-group-regularize"
              open={overdueOpen}
              onToggle={(event) => setOverdueOpen(event.currentTarget.open)}
            >
              <summary className="attendance-list-heading">
                <h2>À régulariser</h2>
                <span className="attendance-heading-control">
                  <span className="attendance-count-badge">{regularizeSessions.length}</span>
                  <ChevronDown className="attendance-overdue-chevron" aria-hidden />
                </span>
              </summary>
              <div className="attendance-queue-rows">
                {regularizeSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    kind="REGULARIZE"
                    isSelected={selectedId === session.id}
                    readOnly={data.readOnly}
                    onSelect={() => selectSession(session.id)}
                  />
                ))}
              </div>
            </details>
          ) : null}

          {completedSessions.length > 0 ? (
            <details
              className="attendance-queue-group attendance-queue-group-done"
              open={completedOpen}
              onToggle={(event) => setCompletedOpen(event.currentTarget.open)}
            >
              <summary className="attendance-list-heading">
                <h2>Finalisées</h2>
                <span className="attendance-heading-control">
                  <span className="attendance-count-badge">{completedSessions.length}</span>
                  <ChevronDown className="attendance-overdue-chevron" aria-hidden />
                </span>
              </summary>
              <div className="attendance-queue-rows">
                {completedSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    kind="DONE"
                    isSelected={selectedId === session.id}
                    readOnly={data.readOnly}
                    onSelect={() => selectSession(session.id)}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </section>

      <div className="attendance-roster-column">
        {effectiveSession && selectedId ? (
          <CheckInDrawer
            open={mobileOpen}
            session={effectiveSession}
            queueKind={effectiveQueueKind ?? "NEXT"}
            activeSubscriptionMemberIds={data.activeSubscriptionMemberIds}
            partialPaymentMemberIds={data.partialPaymentMemberIds}
            partialPaymentDebtsCents={data.partialPaymentDebtsCents}
            onCheckIn={(mid, status, reason, kind) => submitCheckIn(selectedId, mid, status, reason, kind)}
            onClose={closeMobileRoster}
            loadingId={loadingId}
            message={message}
            readOnly={data.readOnly}
            canUndo={!data.readOnly && effectiveSession.attendances.length > 0}
            undoCount={effectiveSession.attendances.length}
            undoLoading={undoLoading}
            onUndo={undoLastForSession}
            finalizeLoading={finalizeLoading}
            onFinalize={() => updateFinalization("finalize")}
            onReopen={() => updateFinalization("reopen")}
            postponeHref={`/sessions?week=${weekStartIsoForDate(new Date(effectiveSession.sessionDate))}&groupId=${effectiveSession.group.id}&sessionId=${effectiveSession.id}`}
          />
        ) : (
          <div className="attendance-roster-placeholder">
            <UsersRoundIcon />
            <p>Sélectionnez une séance pour afficher sa feuille de pointage.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function UsersRoundIcon() {
  return (
    <span className="grid size-12 place-items-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]" aria-hidden>
      <CalendarDays className="size-6" />
    </span>
  );
}
