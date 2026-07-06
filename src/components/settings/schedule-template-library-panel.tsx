import type { FormEvent } from "react";
import { Plus } from "lucide-react";

import { ScheduleTemplateCreateForm } from "@/components/settings/schedule-template-create-form";
import {
  ScheduleTemplateCard,
  type ScheduleSlotInput,
  type ScheduleTemplateDto,
} from "@/components/settings/schedule-template-ui";

type ScheduleTemplateLibraryPanelProps = {
  templates: ScheduleTemplateDto[];
  selectedTemplateId: string | null;
  showCreateForm: boolean;
  name: string;
  description: string;
  slots: ScheduleSlotInput[];
  loading: boolean;
  onToggleCreateForm: () => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSlotChange: (index: number, patch: Partial<ScheduleSlotInput>) => void;
  onSlotRemove: (index: number) => void;
  onSlotAdd: () => void;
  onCreateSubmit: (event: FormEvent) => void;
  onSelectTemplate: (templateId: string) => void;
  onArchiveTemplate: (templateId: string) => void;
};

export function ScheduleTemplateLibraryPanel({
  templates,
  selectedTemplateId,
  showCreateForm,
  name,
  description,
  slots,
  loading,
  onToggleCreateForm,
  onNameChange,
  onDescriptionChange,
  onSlotChange,
  onSlotRemove,
  onSlotAdd,
  onCreateSubmit,
  onSelectTemplate,
  onArchiveTemplate,
}: ScheduleTemplateLibraryPanelProps) {
  return (
    <section className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary)]">Modèles</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Horaires types</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Créez des semaines réutilisables pour saison normale, Ramadan, été ou stages.
          </p>
        </div>
        <button type="button" onClick={onToggleCreateForm} className="btn btn-primary btn-sm">
          <Plus className="size-4" />
          {showCreateForm ? "Fermer" : "Créer"}
        </button>
      </div>

      {showCreateForm ? (
        <ScheduleTemplateCreateForm
          name={name}
          description={description}
          slots={slots}
          loading={loading}
          onNameChange={onNameChange}
          onDescriptionChange={onDescriptionChange}
          onSlotChange={onSlotChange}
          onSlotRemove={onSlotRemove}
          onSlotAdd={onSlotAdd}
          onSubmit={onCreateSubmit}
        />
      ) : null}

      <div className="mt-4 grid gap-2">
        {templates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">
            Aucun modèle pour le moment.
          </div>
        ) : (
          templates.map((template) => (
            <ScheduleTemplateCard
              key={template.id}
              template={template}
              selected={selectedTemplateId === template.id}
              onSelect={() => onSelectTemplate(template.id)}
              onArchive={() => onArchiveTemplate(template.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}
