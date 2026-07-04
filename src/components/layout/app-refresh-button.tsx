"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

export function AppRefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function refresh() {
    setRefreshing(true);
    router.refresh();

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => setRefreshing(false), 850);
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={refreshing}
      title="Actualiser"
      aria-label="Actualiser la page"
      className={cn(
        "flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)] shadow-[var(--shadow-panel)] transition hover:bg-[var(--surface)] disabled:cursor-wait disabled:opacity-70 sm:size-10",
        className,
      )}
    >
      <RefreshCw className={cn("size-4.5", refreshing && "animate-spin")} />
    </button>
  );
}
