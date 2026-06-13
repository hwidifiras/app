"use client";

import { useCallback, useState } from "react";
import { Clock } from "lucide-react";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { weekStartIsoForDate } from "@/lib/dates";
import { useActionHistory } from "@/hooks/use-action-history";
import { SessionCard, type SessionCardData } from "./session-card";
import { CheckInDrawer } from "./check-in-drawer";

type TodayData = {
  sessions: SessionCardData[];
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
  const [selectedId, setSelectedId] = useState<string | null>(
    data.sessions.some((session) => session.id === initialSessionId) ? initialSessionId ?? null : null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const { push, undoLast, loading: undoLoading, countInScope } = useActionHistory<AttendanceUndoMeta["sessionId"]>({
    enableKeyboard: true,
  });

  const effectiveSession = selectedId ? sessions.find((s) => s.id === selectedId) : null;
  const sessionUndoCount = selectedId ? countInScope(selectedId) : 0;

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
      setLoadingId(mid);

      const session = sessions.find((s) => s.id === sessionId);
      const existingAtt = session?.attendances.find((a) => a.memberId === mid);

      let res: Response;

      if (existingAtt) {
        res = await fetch("/api/attendances", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attendanceId: existingAtt.id,
            payload: { status, overrideReason: overrideReason?.trim() || null },
          }),
        });
      } else {
        res = await fetch("/api/attendances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

      const json: { data?: { id: string; status: string }; error?: string; warning?: string } =
        await res.json();
      if (!res.ok) {
        setMessage(json.error ?? "Erreur");
        setLoadingId(null);
        return false;
      }

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
          let undoRes: Response;
          if (meta.kind === "create" || !meta.previous) {
            undoRes = await fetch("/api/attendances", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ attendanceId: meta.attendanceId }),
            });
          } else {
            undoRes = await fetch("/api/attendances", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                attendanceId: meta.attendanceId,
                payload: {
                  status: meta.previous.status,
                  overrideReason: meta.previous.overrideReason,
                },
              }),
            });
          }

          const undoJson: { error?: string; warning?: string } = await undoRes.json();
          if (!undoRes.ok) {
            setMessage(undoJson.error ?? "Impossible d'annuler le pointage");
            return false;
          }

          revertAttendance(meta);
          setMessage(undoJson.warning ?? "Dernier pointage annulé");
          return true;
        },
      });

      setMessage(json.warning ?? "Pointage enregistré");
      setLoadingId(null);
      return true;
    },
    [push, revertAttendance, sessions],
  );

  async function undoLastForSession() {
    if (!selectedId || undoLoading) return;
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
    const response = await fetch("/api/attendances", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceId: latestAttendance.id }),
    });
    const result = (await response.json()) as { error?: string; warning?: string };
    if (!response.ok) {
      setMessage(result.error ?? "Impossible d'annuler le dernier pointage");
      setLoadingId(null);
      return;
    }

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
    setLoadingId(null);
  }

  async function updateFinalization(action: "finalize" | "reopen") {
    if (!selectedId || finalizeLoading) return;
    setFinalizeLoading(true);
    setMessage(null);
    const response = await fetch(`/api/attendances/sessions/${selectedId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const result = (await response.json()) as {
      data?: { status: string };
      error?: string;
    };
    setFinalizeLoading(false);
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
  }

  if (sessions.length === 0) {
    return (
      <div className="panel panel-soft p-8 text-center">
        <Clock className="mx-auto size-8 text-[var(--muted-foreground)] opacity-50" />
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">Aucune séance planifiée aujourd&apos;hui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FeedbackMessage message={message} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            isSelected={selectedId === s.id}
            onSelect={() => setSelectedId(s.id)}
            postponeHref={`/sessions?week=${weekStartIsoForDate(new Date(s.sessionDate))}&groupId=${s.group.id}&sessionId=${s.id}`}
            postponeDisabled={s.attendances.length > 0}
          />
        ))}
      </div>

      {effectiveSession && selectedId && (
        <CheckInDrawer
          session={effectiveSession}
          activeSubscriptionMemberIds={data.activeSubscriptionMemberIds}
          partialPaymentMemberIds={data.partialPaymentMemberIds}
          partialPaymentDebtsCents={data.partialPaymentDebtsCents}
          onCheckIn={(mid, status, reason, kind) => submitCheckIn(selectedId, mid, status, reason, kind)}
          onClose={() => setSelectedId(null)}
          loadingId={loadingId}
          message={message}
          canUndo={effectiveSession.attendances.length > 0}
          undoCount={effectiveSession.attendances.length}
          undoLoading={undoLoading}
          onUndo={undoLastForSession}
          finalizeLoading={finalizeLoading}
          onFinalize={() => updateFinalization("finalize")}
          onReopen={() => updateFinalization("reopen")}
          postponeHref={`/sessions?week=${weekStartIsoForDate(new Date(effectiveSession.sessionDate))}&groupId=${effectiveSession.group.id}&sessionId=${effectiveSession.id}`}
        />
      )}
    </div>
  );
}
