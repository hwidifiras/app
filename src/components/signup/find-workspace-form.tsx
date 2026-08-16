"use client";

import { useState } from "react";
import { ArrowRight, Building2, Loader2 } from "lucide-react";

import { signupApi } from "@/components/signup/signup-client";
import { FeedbackMessage } from "@/components/ui/feedback-message";

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(".")[0]
    ?.replace(/[^a-z0-9-]/g, "") ?? "";
}

export function FindWorkspaceForm({ workspaceDomain }: { workspaceDomain: string }) {
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await signupApi<{ workspaceUrl: string }>("/api/saas-signup/workspace", {
        method: "POST",
        body: JSON.stringify({ slug: normalize(slug) }),
      });
      window.location.assign(new URL("/login", data.workspaceUrl).toString());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de retrouver cet espace.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <FeedbackMessage message={error} variant="error" />
      <div className="space-y-1.5">
        <label htmlFor="workspace-slug" className="text-sm font-semibold text-[#0B1220]">Adresse de votre espace</label>
        <div className="flex min-w-0 items-stretch rounded-lg border border-[#D8E2F0] bg-white focus-within:border-[#2563EB] focus-within:ring-3 focus-within:ring-[#DBEAFE]">
          <span className="flex items-center pl-3 text-[#64748B]"><Building2 className="size-4" /></span>
          <input
            id="workspace-slug"
            value={slug}
            onChange={(event) => setSlug(normalize(event.target.value))}
            className="min-w-0 flex-1 bg-transparent px-2 py-3 text-base outline-none"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="mon-club"
            minLength={2}
            maxLength={48}
            autoFocus
            required
            disabled={loading}
          />
          <span className="flex max-w-[46%] items-center truncate rounded-r-lg border-l border-[#D8E2F0] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#64748B] sm:text-sm">.{workspaceDomain}</span>
        </div>
        <p className="text-xs leading-5 text-[#64748B]">Cette adresse figure dans votre email de bienvenue.</p>
      </div>
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading || slug.length < 2}>
        {loading ? <><Loader2 className="size-4 animate-spin" />Recherche...</> : <>Continuer vers mon espace<ArrowRight className="size-4" /></>}
      </button>
    </form>
  );
}
