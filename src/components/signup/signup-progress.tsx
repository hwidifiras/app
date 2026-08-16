import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const steps = [
  { key: "account", short: "Compte", label: "Votre compte" },
  { key: "verify", short: "Email", label: "Confirmation" },
  { key: "club", short: "Club", label: "Votre club" },
  { key: "edition", short: "Modules", label: "Activités" },
] as const;

export type SignupStep = (typeof steps)[number]["key"];

export function SignupProgress({ current }: { current: SignupStep }) {
  const currentIndex = steps.findIndex((step) => step.key === current);
  return (
    <nav aria-label="Étapes de création" className="w-full">
      <ol className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {steps.map((step, index) => {
          const complete = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step.key} aria-current={active ? "step" : undefined} className="min-w-0">
              <div
                className={cn(
                  "h-1 rounded-full",
                  index <= currentIndex ? "bg-[#2563EB]" : "bg-[#D8E2F0]",
                )}
              />
              <div className="mt-2 flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-bold",
                    complete && "border-[#2563EB] bg-[#2563EB] text-white",
                    active && "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]",
                    !complete && !active && "border-[#CBD5E1] bg-white text-[#64748B]",
                  )}
                >
                  {complete ? <Check className="size-3" /> : index + 1}
                </span>
                <span className={cn("truncate text-[0.68rem] font-semibold sm:text-xs", active ? "text-[#0B1220]" : "text-[#64748B]")}
                >
                  <span className="sm:hidden">{step.short}</span>
                  <span className="hidden sm:inline">{step.label}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
