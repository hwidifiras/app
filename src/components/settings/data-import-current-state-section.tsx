import {
  DATA_IMPORT_TODAY,
  type GroupOption,
  type PlanOption,
} from "@/components/settings/data-import-model";

export type DataImportCurrentStateValues = {
  cutoverDate: string;
  groupId: string;
  planId: string;
  assignmentStartDate: string;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  remainingSessions: string;
  amount: string;
  paid: string;
  paymentDate: string;
  paymentMethod: string;
  note: string;
};

export type DataImportCurrentStateField = keyof DataImportCurrentStateValues;

type DataImportCurrentStateSectionProps = {
  groups: GroupOption[];
  compatiblePlans: PlanOption[];
  selectedPlan: PlanOption | undefined;
  values: DataImportCurrentStateValues;
  onFieldChange: (field: DataImportCurrentStateField, value: string) => void;
  onGroupChange: (value: string) => void;
  onPlanChange: (value: string) => void;
};

export function DataImportCurrentStateSection({
  groups,
  compatiblePlans,
  selectedPlan,
  values,
  onFieldChange,
  onGroupChange,
  onPlanChange,
}: DataImportCurrentStateSectionProps) {
  return (
    <section id="reprise-current" className="form-section-anchor panel p-4 sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">2. État réel</p>
        <h2 className="mt-1 text-lg font-semibold">Affectation et abonnement en cours</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium">
          Date de bascule *
          <input
            type="date"
            className="field mt-1"
            value={values.cutoverDate}
            max={DATA_IMPORT_TODAY}
            onChange={(event) => onFieldChange("cutoverDate", event.target.value)}
            required
          />
        </label>
        <label className="text-sm font-medium">
          Groupe *
          <select className="field mt-1" value={values.groupId} onChange={(event) => onGroupChange(event.target.value)} required>
            <option value="">Sélectionner</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} · {group.sportName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Formule compatible *
          <select
            className="field mt-1"
            value={values.planId}
            onChange={(event) => onPlanChange(event.target.value)}
            disabled={!values.groupId}
            required
          >
            <option value="">Sélectionner</option>
            {compatiblePlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} · {plan.totalSessions} séances
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Affecté au groupe depuis *
          <input
            type="date"
            className="field mt-1"
            value={values.assignmentStartDate}
            max={values.cutoverDate}
            onChange={(event) => onFieldChange("assignmentStartDate", event.target.value)}
            required
          />
        </label>
        <label className="text-sm font-medium">
          Début abonnement *
          <input
            type="date"
            className="field mt-1"
            value={values.subscriptionStartDate}
            max={values.cutoverDate}
            onChange={(event) => onFieldChange("subscriptionStartDate", event.target.value)}
            required
          />
        </label>
        <label className="text-sm font-medium">
          Fin abonnement *
          <input
            type="date"
            className="field mt-1"
            value={values.subscriptionEndDate}
            min={values.cutoverDate}
            onChange={(event) => onFieldChange("subscriptionEndDate", event.target.value)}
            required
          />
        </label>
        <label className="text-sm font-medium">
          Séances restantes *
          <input
            type="number"
            min="1"
            max={selectedPlan?.totalSessions}
            className="field mt-1"
            value={values.remainingSessions}
            onChange={(event) => onFieldChange("remainingSessions", event.target.value)}
            required
          />
        </label>
        <label className="text-sm font-medium">
          Montant total dû (TND) *
          <input
            type="number"
            min="0"
            step="0.01"
            className="field mt-1"
            value={values.amount}
            onChange={(event) => onFieldChange("amount", event.target.value)}
            required
          />
        </label>
        <label className="text-sm font-medium">
          Déjà payé (TND) *
          <input
            type="number"
            min="0"
            step="0.01"
            className="field mt-1"
            value={values.paid}
            onChange={(event) => onFieldChange("paid", event.target.value)}
            required
          />
        </label>
        <label className="text-sm font-medium">
          Date du solde repris
          <input
            type="date"
            className="field mt-1"
            value={values.paymentDate}
            max={values.cutoverDate}
            onChange={(event) => onFieldChange("paymentDate", event.target.value)}
          />
        </label>
        <label className="text-sm font-medium">
          Origine du règlement
          <select className="field mt-1" value={values.paymentMethod} onChange={(event) => onFieldChange("paymentMethod", event.target.value)}>
            <option value="REPRISE_PAPIER">Ancien registre papier</option>
            <option value="CASH">Espèces</option>
            <option value="CARD">Carte</option>
            <option value="TRANSFER">Virement</option>
            <option value="CHECK">Chèque</option>
          </select>
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Note d&apos;import *
          <input className="field mt-1" value={values.note} onChange={(event) => onFieldChange("note", event.target.value)} required />
        </label>
      </div>
    </section>
  );
}
