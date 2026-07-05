import {
  MARTIAL_ARTS_DISCIPLINE_FAMILY_LABELS,
  type MartialArtsDisciplineSuggestion,
} from "@/lib/martial-arts-catalog";
import { cn } from "@/lib/utils";

type SportSuggestionPickerProps = {
  suggestions: MartialArtsDisciplineSuggestion[];
  selectedName: string;
  onSelect: (suggestion: MartialArtsDisciplineSuggestion) => void;
};

const FAMILY_ORDER: MartialArtsDisciplineSuggestion["family"][] = [
  "striking",
  "grappling",
  "traditional",
  "self-defense",
  "weapons",
];

export function SportSuggestionPicker({
  suggestions,
  selectedName,
  onSelect,
}: SportSuggestionPickerProps) {
  if (suggestions.length === 0) return null;

  const selectedKey = selectedName.trim().toLocaleLowerCase("fr");

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Suggestions martiales
        </p>
        <p className="text-sm text-[var(--muted-foreground)]">
          Choisissez un modèle pour préremplir la discipline, ou saisissez librement votre propre nom.
        </p>
      </div>

      <div className="max-h-[24rem] space-y-3 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
        {FAMILY_ORDER.map((family) => {
          const familySuggestions = suggestions.filter((suggestion) => suggestion.family === family);
          if (familySuggestions.length === 0) return null;

          return (
            <section key={family} className="space-y-2">
              <h3 className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
                {MARTIAL_ARTS_DISCIPLINE_FAMILY_LABELS[family]}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {familySuggestions.map((suggestion) => {
                  const selected = selectedKey === suggestion.name.toLocaleLowerCase("fr");
                  return (
                    <button
                      key={suggestion.name}
                      type="button"
                      onClick={() => onSelect(suggestion)}
                      className={cn(
                        "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left transition hover:border-[var(--primary)]/45 hover:bg-[var(--primary)]/5",
                        selected && "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]",
                      )}
                    >
                      <span className="block text-sm font-semibold text-[var(--foreground)]">
                        {suggestion.name}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs text-[var(--muted-foreground)]">
                        {suggestion.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
