"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Check, X, AlertCircle, XIcon } from "lucide-react";
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
    return activeSubscriptionMemberIds.includes(mid);
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">{session.group.name}</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              {session.startTime} – {session.endTime} · {session.room}
              {session.coach ? ` · Coach: ${session.coach.firstName} ${session.coach.lastName}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost p-1">
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Counters */}
        <div className="flex gap-4 border-b border-[var(--border)] px-4 py-2 text-xs">
          <span className="text-[var(--success)] font-medium">{present} présent{present > 1 ? "s" : ""}</span>
          <span className="text-[var(--danger)] font-medium">{absent} absent{absent > 1 ? "s" : ""}</span>
          <span className="text-[var(--muted-foreground)]">{remaining} restant{remaining > 1 ? "s" : ""} / {total}</span>
        </div>

        {/* Message */}
        {message && (
          <div className="px-4 py-2">
            <p className="rounded-md bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">{message}</p>
          </div>
        )}

        {/* Member list */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-[var(--border)]">
            {session.group.members.map((gm) => {
              const att = getAtt(gm.memberId);
              const mid = gm.memberId;
              const activeSub = hasSub(mid);

              return (
                <div key={gm.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--surface-soft)]">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
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
                    <div>
                      <p className="text-sm font-medium">
                        {gm.member.firstName} {gm.member.lastName}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {!activeSub && (
                          <span className="text-[0.65rem] text-[var(--warning)] font-medium">⚠ Sans abonnement actif</span>
                        )}
                        {att && (
                          <StatusBadge
                            variant={
                              att.status === "PRESENT"
                                ? "success"
                                : att.status === "ABSENT"
                                ? "danger"
                                : att.status === "EXCUSED"
                                ? "info"
                                : "warning"
                            }
                          >
                            {att.status === "PRESENT"
                              ? "Présent"
                              : att.status === "ABSENT"
                              ? "Absent"
                              : att.status === "EXCUSED"
                              ? "Excusé"
                              : "Exception"}
                          </StatusBadge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleClick(mid, "PRESENT")}
                      disabled={loadingId === mid}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--success)] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--success)]/90 active:scale-95 transition-all disabled:opacity-50"
                      title="Présent"
                    >
                      <Check className="size-4" />
                      <span className="hidden sm:inline">Présent</span>
                    </button>
                    <button
                      onClick={() => handleClick(mid, "ABSENT")}
                      disabled={loadingId === mid}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--danger)] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--danger)]/90 active:scale-95 transition-all disabled:opacity-50"
                      title="Absent"
                    >
                      <X className="size-4" />
                      <span className="hidden sm:inline">Absent</span>
                    </button>
                    <button
                      onClick={() => handleClick(mid, "EXCUSED")}
                      disabled={loadingId === mid}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--info)] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--info)]/90 active:scale-95 transition-all disabled:opacity-50"
                      title="Excusé"
                    >
                      <AlertCircle className="size-4" />
                      <span className="hidden sm:inline">Excusé</span>
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-[var(--foreground)]">Passage exceptionnel</h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {modalMember.name} n&apos;a pas d&apos;abonnement actif. Un motif est obligatoire.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motif du passage exceptionnel..."
              className="field mt-3 min-h-[80px]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setModalMember(null); setReason(""); }}
                className="btn btn-ghost"
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
                className="btn btn-primary"
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
