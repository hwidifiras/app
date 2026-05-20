"use client";

import { useEffect, useState } from "react";
import { FeedbackMessage } from "@/components/ui/feedback-message";

type HouseholdMember = {
  id: string;
  relationship: string;
  member: { id: string; firstName: string; lastName: string; phone: string };
};

type HouseholdInfo = {
  id: string;
  label: string | null;
  members: HouseholdMember[];
};

type HouseholdData = {
  household: HouseholdInfo;
} | null;

export function HouseholdCard({ memberId }: { memberId: string }) {
  const [data, setData] = useState<HouseholdData>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [addMemberId, setAddMemberId] = useState("");
  const [relationship, setRelationship] = useState("SIBLING");

  function load() {
    setLoading(true);
    fetch(`/api/households?memberId=${memberId}`)
      .then((r) => r.json())
      .then((json) => {
        const link = json.data as { household?: HouseholdInfo } | null;
        setData(link?.household ? { household: link.household } : null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [memberId]);

  async function createHousehold() {
    const res = await fetch("/api/households", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, relationship: "OTHER" }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error);
      return;
    }
    load();
  }

  async function addMember() {
    if (!data?.household?.id || !addMemberId) return;
    const res = await fetch("/api/households", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ householdId: data.household.id, memberId: addMemberId, relationship }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error);
      return;
    }
    setAddMemberId("");
    load();
  }

  if (loading) return <p className="text-sm text-[var(--muted-foreground)]">Chargement foyer…</p>;

  return (
    <section className="panel p-5">
      <h2 className="mb-3 text-lg font-semibold">Famille / foyer</h2>
      {message && <FeedbackMessage variant="error" message={message} />}

      {!data?.household ? (
        <div>
          <p className="mb-2 text-sm text-[var(--muted-foreground)]">
            Liez les frères/sœurs ou parent-enfant pour les offres famille.
          </p>
          <button type="button" className="btn-primary text-sm" onClick={createHousehold}>
            Créer un foyer pour cet élève
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-1 text-sm">
            {data.household.members.map((hm) => (
              <li key={hm.id}>
                <a href={`/members/${hm.member.id}`} className="text-[var(--primary)] hover:underline">
                  {hm.member.firstName} {hm.member.lastName}
                </a>{" "}
                <span className="text-[var(--muted-foreground)]">({hm.relationship})</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded border px-2 py-1 text-sm"
              placeholder="ID membre à lier"
              value={addMemberId}
              onChange={(e) => setAddMemberId(e.target.value)}
            />
            <select
              className="rounded border px-2 py-1 text-sm"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
            >
              <option value="PARENT">Parent</option>
              <option value="CHILD">Enfant</option>
              <option value="SIBLING">Frère/Sœur</option>
              <option value="GUARDIAN">Tuteur</option>
              <option value="OTHER">Autre</option>
            </select>
            <button type="button" className="btn-secondary text-sm" onClick={addMember}>
              Ajouter au foyer
            </button>
          </div>
          <a href="/enrollment" className="text-sm text-[var(--primary)] hover:underline">
            Inscrire plusieurs membres du foyer
          </a>
        </div>
      )}
    </section>
  );
}
