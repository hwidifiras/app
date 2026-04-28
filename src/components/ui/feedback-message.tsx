import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

type FeedbackMessageProps = {
  message: string | null;
  variant?: "success" | "error" | "info";
  className?: string;
};

const variantConfig = {
  success: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  error: {
    icon: AlertCircle,
    className: "border-red-200 bg-red-50 text-red-700",
  },
  info: {
    icon: Info,
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
};

export function FeedbackMessage({ message, variant, className }: FeedbackMessageProps) {
  if (!message) return null;

  const resolvedVariant =
    variant ?? (message.includes("succès") || message.includes("créée") || message.includes("supprimé") ? "success" : "error");

  const config = variantConfig[resolvedVariant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
        config.className,
        className,
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
