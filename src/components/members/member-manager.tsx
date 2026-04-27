"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { MemberDto } from "@/types/member";

type MemberManagerProps = {
  initialMembers: MemberDto[];
};

export function MemberManager({ initialMembers }: MemberManagerProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [members, setMembers] = useState<MemberDto[]>(initialMembers);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function reloadMembers(query?: string) {
    const params = new URLSearchParams();
    if (query && query.trim().length > 0) {
      params.set("q", query.trim());
    }

    const endpoint = params.toString() ? `/api/members?${params.toString()}` : "/api/members";
    const response = await fetch(endpoint, { cache: "no-store" });
    const result = await response.json();
    setMembers(result.data ?? []);
  }

  async function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await reloadMembers(searchTerm);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, phone, email }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la création du membre");
      setLoading(false);
      return;
    }

    setMessage("Membre créé avec succès");
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    await reloadMembers();
    setLoading(false);
  }

  function startEdit(member: MemberDto) {
    setEditingId(member.id);
    setEditFirstName(member.firstName);
    setEditLastName(member.lastName);
    setEditPhone(member.phone);
    setEditEmail(member.email ?? "");
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditFirstName("");
    setEditLastName("");
    setEditPhone("");
    setEditEmail("");
  }

  async function saveEdit(memberId: string) {
    setActionLoadingId(memberId);
    setMessage(null);

    const response = await fetch("/api/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId,
        payload: {
          firstName: editFirstName,
          lastName: editLastName,
          phone: editPhone,
          email: editEmail,
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la modification du membre");
      setActionLoadingId(null);
      return;
    }

    setMessage("Membre modifié avec succès");
    cancelEdit();
    await reloadMembers();
    setActionLoadingId(null);
  }

  async function archiveMember(memberId: string) {
    const confirmed = window.confirm("Confirmer l'archivage de ce membre ?");
    if (!confirmed) {
      return;
    }

    setActionLoadingId(memberId);
    setMessage(null);

    const response = await fetch("/api/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de l'archivage du membre");
      setActionLoadingId(null);
      return;
    }

    setMessage("Membre archivé avec succès");
    if (editingId === memberId) {
      cancelEdit();
    }
    await reloadMembers();
    setActionLoadingId(null);
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <div className="mb-5 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Parcours réception</p>
        <h1 className="text-2xl font-semibold text-[var(--foreground)] md:text-3xl">Gestion des membres</h1>
      </div>

      <div className="grid w-full gap-6 md:grid-cols-2">
        <section className="panel panel-soft p-6">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">US-01/US-02 - Gestion membre</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Interface MVP réception: création, modification et archivage d&apos;un membre.
          </p>
          <p className="mt-3 text-sm">
            <Link href="/sports" className="font-medium text-[var(--primary)] underline">
              Accéder à la gestion des sports (US-03)
            </Link>
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Prénom"
              className="field"
              required
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Nom"
              className="field"
              required
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Téléphone"
              className="field"
              required
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optionnel)"
              className="field"
            />

            <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5 text-sm">
              {loading ? "Enregistrement..." : "Créer membre"}
            </button>
          </form>

          {message ? <p className="mt-4 text-sm text-[var(--foreground)]">{message}</p> : null}
        </section>

        <section className="panel p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Membres récents</h2>
            <form onSubmit={onSearchSubmit} className="flex w-full gap-2 sm:w-auto">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher nom/téléphone"
                className="field text-xs sm:w-56"
              />
              <button type="submit" className="btn btn-ghost whitespace-nowrap">
                Rechercher
              </button>
            </form>
          </div>

          <ul className="mt-4 space-y-3">
            {members.map((member) => (
              <li key={member.id} className="rounded-xl border border-[var(--border)] p-3">
                {editingId === member.id ? (
                  <div className="space-y-2">
                    <input
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      placeholder="Prénom"
                      className="field text-xs"
                    />
                    <input
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      placeholder="Nom"
                      className="field text-xs"
                    />
                    <input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Téléphone"
                      className="field text-xs"
                    />
                    <input
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="Email"
                      className="field text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(member.id)}
                        disabled={actionLoadingId === member.id}
                        className="btn btn-primary"
                      >
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={actionLoadingId === member.id}
                        className="btn btn-ghost"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-xs text-[var(--muted)]">{member.phone}</p>
                        <p className="text-xs text-[var(--muted)]">{member.email ?? "-"}</p>
                      </div>
                      <span className={`chip ${member.status === "ACTIVE" ? "chip-active" : "chip-muted"}`}>
                        {member.status === "ACTIVE" ? "ACTIF" : "ARCHIVÉ"}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(member)}
                        disabled={actionLoadingId === member.id || member.status === "ARCHIVED"}
                        className="btn btn-ghost"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => archiveMember(member.id)}
                        disabled={actionLoadingId === member.id || member.status === "ARCHIVED"}
                        className="btn btn-danger"
                      >
                        Archiver
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
            {members.length === 0 ? (
              <li className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                Aucun membre enregistré pour le moment.
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </main>
  );
}
