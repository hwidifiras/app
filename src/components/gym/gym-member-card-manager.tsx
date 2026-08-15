"use client";

import { useState } from "react";
import { CreditCard, Printer, RefreshCw, ShieldX } from "lucide-react";

type CardPayload = {
  credential: {
    id: string;
    codeHint: string;
    issuedAt: string;
    credentialCode: string;
    qrDataUrl: string;
  };
  member: { id: string; firstName: string; lastName: string; phone: string };
  club: { name: string; logoUrl: string; phone: string };
};

export function GymMemberCardManager({
  memberId,
  memberName,
  initialCredential,
}: {
  memberId: string;
  memberName: string;
  initialCredential: { id: string; codeHint: string; issuedAt: string } | null;
}) {
  const [credential, setCredential] = useState(initialCredential);
  const [card, setCard] = useState<CardPayload | null>(null);
  const [mode, setMode] = useState<"idle" | "replace" | "revoke">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadCard() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/gym/credentials?memberId=${encodeURIComponent(memberId)}`, { cache: "no-store" });
      const json = (await response.json()) as { data?: CardPayload | null; error?: string };
      if (!response.ok) throw new Error(json.error || "Carte indisponible");
      if (!json.data) throw new Error("Aucune carte active");
      setCard(json.data);
      setCredential({
        id: json.data.credential.id,
        codeHint: json.data.credential.codeHint,
        issuedAt: json.data.credential.issuedAt,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Carte indisponible");
    } finally {
      setBusy(false);
    }
  }

  async function issueCard(replacement = false) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/gym/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          ...(replacement ? { replacementReason: reason.trim() } : {}),
        }),
      });
      const json = (await response.json()) as { data?: CardPayload; error?: string };
      if (!response.ok || !json.data) throw new Error(json.error || "Création de la carte impossible");
      setCard(json.data);
      setCredential({
        id: json.data.credential.id,
        codeHint: json.data.credential.codeHint,
        issuedAt: json.data.credential.issuedAt,
      });
      setMode("idle");
      setReason("");
      setMessage(replacement ? "Ancienne carte révoquée, nouvelle carte créée." : "Carte créée.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Création de la carte impossible");
    } finally {
      setBusy(false);
    }
  }

  async function revokeCard() {
    if (!credential) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/gym/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId: credential.id, reason: reason.trim() }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Révocation impossible");
      setCredential(null);
      setCard(null);
      setMode("idle");
      setReason("");
      setMessage("Carte révoquée. Elle ne permet plus aucun accès.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Révocation impossible");
    } finally {
      setBusy(false);
    }
  }

  function printCard() {
    document.documentElement.dataset.printMode = "gym-card";
    const cleanup = () => {
      delete document.documentElement.dataset.printMode;
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--primary)]">Accès salle</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--foreground)]">Carte QR membre</h2>
        </div>
        <CreditCard className="size-5 text-[var(--muted-foreground)]" />
      </div>

      {credential ? (
        <div className="mt-3 text-sm text-[var(--muted-foreground)]">
          <p>Carte active · fin <span className="font-mono text-[var(--foreground)]">{credential.codeHint}</span></p>
          <p className="mt-1 text-xs">Émise le {new Intl.DateTimeFormat("fr-FR").format(new Date(credential.issuedAt))}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">Aucune carte active pour {memberName}.</p>
      )}

      {message ? <p className="mt-3 rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--foreground)]" role="status">{message}</p> : null}

      <div className="mt-4 grid gap-2">
        {credential ? (
          <>
            <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void loadCard()}>
              <Printer className="size-4" /> {busy ? "Chargement..." : "Afficher et imprimer"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setMode("replace"); setReason(""); }}><RefreshCw className="size-4" /> Remplacer</button>
              <button type="button" className="btn btn-ghost btn-sm text-red-700" onClick={() => { setMode("revoke"); setReason(""); }}><ShieldX className="size-4" /> Révoquer</button>
            </div>
          </>
        ) : (
          <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void issueCard()}>
            <CreditCard className="size-4" /> {busy ? "Création..." : "Créer la carte"}
          </button>
        )}
      </div>

      {mode !== "idle" ? (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <label htmlFor="gym-card-reason" className="text-xs font-semibold text-[var(--foreground)]">
            {mode === "replace" ? "Pourquoi remplacer la carte ?" : "Pourquoi révoquer la carte ?"}
          </label>
          <textarea id="gym-card-reason" className="field mt-2 min-h-20 w-full resize-y py-2" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex. carte perdue" />
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn btn-ghost flex-1" onClick={() => setMode("idle")}>Annuler</button>
            <button type="button" className="btn btn-primary flex-1" disabled={busy || reason.trim().length < 3} onClick={() => mode === "replace" ? void issueCard(true) : void revokeCard()}>
              Confirmer
            </button>
          </div>
        </div>
      ) : null}

      {card ? (
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <article data-gym-access-card className="mx-auto flex aspect-[1.586/1] w-full max-w-[25rem] overflow-hidden rounded-lg border border-slate-300 bg-white text-[#0B1220] shadow-sm">
            <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
              <div className="flex items-start gap-2">
                {card.club.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.club.logoUrl} alt="" className="size-10 object-contain" />
                ) : null}
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold uppercase text-[#2563EB]">{card.club.name}</p>
                  <p className="mt-0.5 text-[0.62rem] text-slate-500">Carte d&apos;accès salle</p>
                </div>
              </div>
              <div>
                <p className="truncate text-base font-black">{card.member.firstName} {card.member.lastName}</p>
                <p className="mt-1 text-xs text-slate-600">{card.member.phone}</p>
                <p className="mt-2 font-mono text-[0.55rem] text-slate-400">•••• {card.credential.codeHint}</p>
              </div>
            </div>
            <div className="flex w-[42%] shrink-0 items-center justify-center border-l border-slate-200 bg-slate-50 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.credential.qrDataUrl} alt="QR code d'accès salle" className="w-full" />
            </div>
          </article>
          <button type="button" className="btn btn-primary mt-3 w-full" onClick={printCard}><Printer className="size-4" /> Imprimer la carte</button>
        </div>
      ) : null}
    </section>
  );
}
