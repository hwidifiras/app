"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { cn } from "@/lib/utils";

export function LogoutButton({ className, onDone }: { className?: string; onDone?: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    if (loading) return;
    setLoading(true);

    await fetch("/api/auth/logout", { method: "POST" });

    onDone?.();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[0.82rem] font-medium transition-all",
        "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
        className,
      )}
    >
      <LogOut className="size-[1.1rem] shrink-0 opacity-60" />
      <span className="truncate">{loading ? "Déconnexion..." : "Déconnexion"}</span>
    </button>
  );
}
