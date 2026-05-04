"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { SessionCard, type SessionCardData } from "./session-card";
import { CheckInDrawer } from "./check-in-drawer";

type TodayData = { sessions: SessionCardData[]; activeSubscriptionMemberIds: string[]; now: string };

export function CheckInPanel({ data }: { data: TodayData }) {
  const now = new Date(data.now);
  const [sessions, setSessions] = useState(data.sessions);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [coachAbsentModal, setCoachAbsentModal] = useState<SessionCardData | null>(null);
  const [coachAction, setCoachAction] = useState<"CANCELLED" | "RESCHEDULED">("CANCELLED");
  const [coachReason, setCoachReason] = useState("");

  const effectiveSession = selectedId ? sessions.find((s) => s.id === selectedId) : null;

  async function submitCheckIn(sessionId: string, mid: string, status: string, overrideReason?: string) {
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
        body: JSON.stringify({ sessionId, memberId: mid, status, overrideReason, checkedBy: "Réception" }),
      });
    }

    const json: { data?: { id: string; status: string }; error?: string; warning?: string } = await res.json();
    if (!res.ok) {
      setMessage(json.error ?? "Erreur");
      setLoadingId(null);
      return;
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, attendances: [...s.attendances.filter((a) => a.memberId !== mid), { id: json.data?.id ?? existingAtt?.id ?? "", memberId: mid, status: json.data?.status ?? status }] }
          : s
      )
    );
    setMessage(json.warning ?? "Pointage enregistré");
    setLoadingId(null);
  }

  async function handleCoachAbsent() {
    if (!coachAbsentModal || !coachReason.trim()) return;
    const res = await fetch(`/api/sessions/${coachAbsentModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: coachAction,
        exceptionReason: `Coach absent: ${coachReason.trim()}`,
      }),
    });
    if (!res.ok) {
      setMessage("Erreur lors de la mise à jour de la séance");
      return;
    }
    const json = await res.json();
    setSessions((prev) =>
      prev.map((s) =>
        s.id === coachAbsentModal.id ? { ...s, status: json.data?.status ?? coachAction } : s
      )
    );
    setCoachAbsentModal(null);
    setCoachReason("");
    setMessage(`Séance ${coachAction === "CANCELLED" ? "annulée" : "reportée"}`);
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
            now={now}
            isSelected={selectedId === s.id}
            onSelect={() => setSelectedId(s.id)}
            onCoachAbsent={() => setCoachAbsentModal(s)}
          />
        ))}
      </div>

      {/* Drawer */}
      {effectiveSession && selectedId && (
        <CheckInDrawer
          session={effectiveSession}
          activeSubscriptionMemberIds={data.activeSubscriptionMemberIds}
          onCheckIn={(mid, status, reason) => submitCheckIn(selectedId, mid, status, reason)}
          onClose={() => setSelectedId(null)}
          loadingId={loadingId}
          message={message}
        />
      )}

      {/* Coach absent modal */}
      {coachAbsentModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-[var(--foreground)]">Coach absent</h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Séance : {coachAbsentModal.group.name} — {coachAbsentModal.startTime} à {coachAbsentModal.endTime}
            </p>
            <div className="mt-3 flex gap-2">
              <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-soft)] cursor-pointer">
                <input
                  type="radio"
                  name="coachAction"
                  value="CANCELLED"
                  checked={coachAction === "CANCELLED"}
                  onChange={() => setCoachAction("CANCELLED")}
                />
                Annuler la séance
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-soft)] cursor-pointer">
                <input
                  type="radio"
                  name="coachAction"
                  value="RESCHEDULED"
                  checked={coachAction === "RESCHEDULED"}
                  onChange={() => setCoachAction("RESCHEDULED")}
                />
                Reporter la séance
              </label>
            </div>
            <textarea
              value={coachReason}
              onChange={(e) => setCoachReason(e.target.value)}
              placeholder="Motif de l'absence du coach..."
              className="field mt-3 min-h-[80px]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setCoachAbsentModal(null); setCoachReason(""); }} className="btn btn-ghost">Annuler</button>
              <button
                onClick={handleCoachAbsent}
                disabled={!coachReason.trim()}
                className="btn btn-primary"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
