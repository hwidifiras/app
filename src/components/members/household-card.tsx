"use client";

import { useEffect, useMemo, useState } from "react";
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

type MemberSearchHit = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export function HouseholdCard({ memberId }: { memberId: string }) {
  const [data, setData] = useState<HouseholdData>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberSearchHit | null>(null);
  const [relationship, setRelationship] = useState("SIBLING");

  const excludeIds = useMemo(() => {
    const ids = new Set<string>([memberId]);
    data?.household.members.forEach((hm) => ids.add(hm.member.id));
    return ids;
  }, [memberId, data]);

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

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setSearching(true);
      fetch(`/api/members?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((json) => {
          const hits = (json.data ?? []) as MemberSearchHit[];
          setSearchResults(hits.filter((m) => !excludeIds.has(m.id)));
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 280);

    return () => window.clearTimeout(timer);
  }, [searchQuery, excludeIds]);

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
    if (!data?.household?.id || !selectedMember) return;
    const res = await fetch("/api/households", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        householdId: data.household.id,
        memberId: selectedMember.id,
        relationship,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error);
      return;
    }
    setSearchQuery("");
    setSearchResults([]);
    setSelectedMember(null);
    setMessage(null);
    load();
  }

  function pickMember(member: MemberSearchHit) {
    setSelectedMember(member);
    setSearchQuery(`${member.firstName} ${member.lastName}`);
    setSearchResults([]);
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
          <button type="button" className="btn btn-primary btn-block-mobile min-h-11 text-sm sm:w-auto" onClick={createHousehold}>
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
                <span className="text-[var(--muted-foreground)]">({hm.relationship}) · {hm.member.phone}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/50 p-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Ajouter un membre au foyer
            </label>
            <input
              type="search"
              className="field"
              placeholder="Nom, prénom ou numéro de téléphone…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (selectedMember && e.target.value !== `${selectedMember.firstName} ${selectedMember.lastName}`) {
                  setSelectedMember(null);
                }
              }}
              autoComplete="off"
            />
            {searching ? (
              <p className="text-xs text-[var(--muted-foreground)]">Recherche…</p>
            ) : null}
            {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && !selectedMember ? (
              <p className="text-xs text-[var(--muted-foreground)]">Aucun élève trouvé.</p>
            ) : null}
            {searchResults.length > 0 ? (
              <ul className="max-h-40 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                {searchResults.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2 text-left text-sm transition hover:bg-[var(--surface-soft)]"
                      onClick={() => pickMember(m)}
                    >
                      <span className="font-medium text-[var(--foreground)]">
                        {m.firstName} {m.lastName}
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)]">{m.phone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {selectedMember ? (
              <p className="text-sm text-[var(--foreground)]">
                Sélectionné :{" "}
                <span className="font-medium">
                  {selectedMember.firstName} {selectedMember.lastName}
                </span>{" "}
                <span className="text-[var(--muted-foreground)]">({selectedMember.phone})</span>
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <select
                className="field w-full max-w-none py-2 text-sm sm:max-w-[10rem]"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
              >
                <option value="PARENT">Parent</option>
                <option value="CHILD">Enfant</option>
                <option value="SIBLING">Frère/Sœur</option>
                <option value="GUARDIAN">Tuteur</option>
                <option value="OTHER">Autre</option>
              </select>
              <button
                type="button"
                className="btn btn-secondary btn-block-mobile min-h-11 text-sm sm:w-auto"
                disabled={!selectedMember}
                onClick={addMember}
              >
                Ajouter au foyer
              </button>
            </div>
          </div>

          <a href="/enrollment" className="text-sm text-[var(--primary)] hover:underline">
            Inscrire plusieurs membres du foyer
          </a>
        </div>
      )}
    </section>
  );
}
