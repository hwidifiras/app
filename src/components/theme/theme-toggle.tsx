"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/theme-provider";
import type { ThemeMode } from "@/lib/theme";

const options: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "Clair", icon: Sun },
  { mode: "dark", label: "Sombre", icon: Moon },
  { mode: "system", label: "Système", icon: Monitor },
];

export function ThemeToggle({ className, compact }: { className?: string; compact?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={cn("space-y-1.5", className)}>
      {!compact ? (
        <p className="px-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Apparence
        </p>
      ) : null}
      <div className="grid grid-cols-3 gap-1" role="group" aria-label="Thème d'affichage">
        {options.map(({ mode, label, icon: Icon }) => {
          const active = theme === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setTheme(mode)}
              title={label}
              aria-label={label}
              className={cn(
                "flex min-h-[2.75rem] flex-row flex-wrap items-center justify-center rounded-lg transition-all",
                compact ? "px-2 py-2" : "gap-2 px-3 py-2 text-sm font-semibold",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-[var(--surface)] hover:text-foreground",
              )}
              aria-pressed={active}
            >
              <Icon className={cn("shrink-0", compact ? "size-5" : "size-4")} />
              {!compact ? <span>{label}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
