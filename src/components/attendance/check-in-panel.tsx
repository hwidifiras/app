"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { SessionCard, type SessionCardData } from "./session-card";
import { CheckInDrawer } from "./check-in-drawer";

type TodayData = { sessions: SessionCardData[]; activeSubscriptionMemberIds: string[] };

export function CheckInPanel({ data }: { data: TodayData }) {
  const [sessions, setSessions] = useState(data.sessions);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const effectiveSession = selectedId ? sessions.find((s) => s.id === selectedId) : null;

  async function submitCheckIn(
    sessionId: string,
    mid: string,
    status: string,
    overrideReason?: string,
    overrideKind?: "STANDARD" | "RECOVERY",
  ): Promise<boolean> {
    setLoadingId(mid);

    // Find existing attendance for this session+member
    const session = sessions.find((s) => s.id === sessionId);
    const existingAtt = session?.attendances.find((a) => a.memberId === mid);

    let res: Response;

    if (existingAtt) {
      // Update existing attendance via PATCH
      res = await fetch("/api/attendances", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceId: existingAtt.id,
          payload: { status, overrideReason: overrideReason?.trim() || null },
        }),
      });
    } else {
      // Create new attendance
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

    const json: { data?: { id: string; status: string }; error?: string; warning?: string } = await res.json();
    if (!res.ok) {
      setMessage(json.error ?? "Erreur");
      setLoadingId(null);
      return false;
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              attendances: [
                ...s.attendances.filter((a) => a.memberId !== mid),
                {
                  id: json.data?.id ?? existingAtt?.id ?? "",
                  memberId: mid,
                  status: json.data?.status ?? status,
                },
              ],
            }
          : s,
      ),
    );
    setMessage(json.warning ?? "Pointage enregistré");
    setLoadingId(null);
    return true;
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

      {/* Session cards grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            isSelected={selectedId === s.id}
            onSelect={() => setSelectedId(s.id)}
            postponeHref={`/sessions/${s.id}/postpone`}
          />
        ))}
      </div>

      {/* Drawer */}
      {effectiveSession && selectedId && (
        <CheckInDrawer
          session={effectiveSession}
          activeSubscriptionMemberIds={data.activeSubscriptionMemberIds}
          onCheckIn={(mid, status, reason, kind) => submitCheckIn(selectedId, mid, status, reason, kind)}
          onClose={() => setSelectedId(null)}
          loadingId={loadingId}
          message={message}
        />
      )}

    </div>
  );
}
