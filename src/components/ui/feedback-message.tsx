import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

type FeedbackMessageProps = {
  message: string | null;
  variant?: "success" | "error" | "info";
  className?: string;
};

type FeedbackVariant = NonNullable<FeedbackMessageProps["variant"]>;

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

const ERROR_CUES = [
  "erreur",
  "impossible",
  "echec",
  "echoue",
  "invalide",
  "obligatoire",
  "requis",
  "depasse",
  "ne peut pas",
  "doit etre",
  "choisissez",
  "entrez",
  "correspondent pas",
  "deja annule",
  "identique",
  "manquant",
];

const SUCCESS_CUES = [
  "succes",
  "cree",
  "modifie",
  "mis a jour",
  "enregistre",
  "reussi",
  "active",
  "ferme",
  "annule",
  "resilie",
  "desactive",
  "retire",
  "finalise",
  "rouverte",
  "importe",
  "envoye",
  "termine",
  "ajoute",
  "affectation reussie",
  "confirm",
];

const INFO_CUES = [
  "aucun",
  "aucune",
  "deja",
  "si ce compte existe",
];

function normalizeMessage(message: string) {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function inferFeedbackVariant(message: string): FeedbackVariant {
  const normalized = normalizeMessage(message);

  if (ERROR_CUES.some((cue) => normalized.includes(cue))) return "error";
  if (SUCCESS_CUES.some((cue) => normalized.includes(cue))) return "success";
  if (INFO_CUES.some((cue) => normalized.includes(cue))) return "info";

  return "error";
}

export function FeedbackMessage({ message, variant, className }: FeedbackMessageProps) {
  if (!message) return null;

  const resolvedVariant = variant ?? inferFeedbackVariant(message);

  const config = variantConfig[resolvedVariant];
  const Icon = config.icon;
  const isError = resolvedVariant === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
        config.className,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
