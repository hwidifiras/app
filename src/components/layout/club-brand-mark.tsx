"use client";

import { Dumbbell } from "lucide-react";

import { cn } from "@/lib/utils";
import { useClubBranding } from "@/components/layout/club-branding-provider";

type ClubBrandMarkProps = {
  size?: "sm" | "md";
  className?: string;
};

const iconSizes = { sm: "size-8", md: "size-9" } as const;

export function ClubBrandMark({ size = "md", className }: ClubBrandMarkProps) {
  const { displayName, appName, logoUrl } = useClubBranding();
  const hasCustomName = displayName !== appName;
  const iconBox = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--primary)] text-white",
    iconSizes[size],
    className,
  );

  return (
    <>
      {logoUrl ? (
        <div className={cn(iconBox, "bg-[var(--surface-soft)] p-0.5")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt=""
            className="size-full rounded-[calc(var(--radius)-2px)] object-contain"
          />
        </div>
      ) : (
        <div className={iconBox}>
          <Dumbbell className={size === "sm" ? "size-4" : "size-5"} />
        </div>
      )}
      <div className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-bold text-[var(--foreground)]">{displayName}</span>
        <span className="block truncate text-[0.65rem] font-medium text-[var(--muted-foreground)]">
          {hasCustomName ? appName : "Réception"}
        </span>
      </div>
    </>
  );
}
