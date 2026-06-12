"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";
import { weekStartIsoForDate } from "@/lib/dates";
import { parseApiResponse } from "@/lib/parse-api-response";

const reasonOptions = [
  { value: "MAUVAIS_METEO", label: "Mauvais météo" },
  { value: "COACH_ABSENT", label: "Coach absent" },
  { value: "AUTRE", label: "Autre" },
] as const;

type ReasonValue = (typeof reasonOptions)[number]["value"];

type PostponeFormProps = {
  sessionId: string;
  initialDateTime: string;
};

function toDateTimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function PostponeForm({ sessionId, initialDateTime }: PostponeFormProps) {
  const router = useRouter();
  const [dateTime, setDateTime] = useState(() => toDateTimeLocalValue(initialDateTime));
  const [reason, setReason] = useState<ReasonValue>("MAUVAIS_METEO");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const payload = {
      postponedTo: dateTime ? new Date(dateTime).toISOString() : "",
      reason,
      details: details.trim() ? details.trim() : undefined,
    };

    const response = await fetch(`/api/sessions/${sessionId}/postpone`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await parseApiResponse<{ data?: { sessionDate: string }; error?: string }>(response);

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors du report");
      setLoading(false);
      return;
    }

    const targetWeek = result.data?.sessionDate
      ? weekStartIsoForDate(new Date(result.data.sessionDate))
      : null;

    if (targetWeek) {
      router.push(`/sessions?week=${targetWeek}`);
    } else {
      router.push("/attendance/today");
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="panel p-5 space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Nouvelle date et heure</label>
        <input
          type="datetime-local"
          value={dateTime}
          onChange={(event) => setDateTime(event.target.value)}
          required
          className="field"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Motif</label>
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value as ReasonValue)}
          className="field"
        >
          {reasonOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {reason === "AUTRE" ? (
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Détails (optionnel)</label>
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Décrire la situation..."
            className="field min-h-[90px]"
          />
        </div>
      ) : null}

      <FeedbackMessage message={message} />

      <FormActions sticky>
        <button type="button" onClick={() => router.push("/attendance/today")} className="btn btn-ghost btn-block-mobile">
          Retour au pointage
        </button>
        <button type="submit" disabled={loading || !dateTime} className="btn btn-primary btn-block-mobile">
          {loading ? "Enregistrement..." : "Reporter la séance"}
        </button>
      </FormActions>
    </form>
  );
}
