import writeExcelFile from "write-excel-file/node";
import { studentImportCatalog, type StudentImportOptions } from "@/lib/student-excel-import";

export async function studentExcelTemplate(tenantId: string, options: StudentImportOptions) {
  const catalog = await studentImportCatalog(tenantId);
  const plans = catalog.plans.filter((plan) => plan.planKind === options.kind);
  const plan = plans.find((item) => item.id === options.defaultPlanId);
  if (options.defaultPlanId && !plan) throw new Error("Formule sélectionnée indisponible.");
  const names = [...new Set((plan ? [plan] : plans).flatMap((item) => item.entitlements.filter((right) => right.type === "CLASS_SESSIONS").map((right) => right.sport?.name ?? right.sportId ?? "")))].sort();
  const columns = ["Prénom", "Nom", "Type membre", "Genre", "Téléphone", "Téléphone parent", "Nom parent", "Date naissance", "Email", "Adresse", "Formule", "Groupes", "Date début", "Date fin", "Activation", "Montant total", "Déjà payé", "Assurance payée", "Date assurance", ...(options.kind !== "GYM" ? names.length ? names.map((name) => `Restant ${name}`) : ["Séances restantes"] : []), ...(options.kind !== "CLASS" ? ["Visites restantes"] : [])];
  const header = (values: string[]) => values.map((value) => ({ value, fontWeight: "bold" as const, backgroundColor: "#123a65", textColor: "#ffffff" }));
  const selectedGroups = catalog.groups.filter((group) => options.groupIds.includes(group.id));
  const blank = columns.map((name) => ({ value: name === "Type membre" ? "ADULT" : name === "Formule" ? plan?.name ?? "" : name === "Groupes" ? selectedGroups.map((group) => group.name).join("|") : name === "Date début" ? options.cutoverDate : "", type: String, format: "@" }));
  return writeExcelFile([
    { sheet: "Élèves", data: [header(columns), blank], columns: columns.map(() => ({ width: 24 })), stickyRowsCount: 1 },
    { sheet: "Formules et groupes", data: [header(["Formule", "Type", "Prix (monnaie du club)", "Activation", "Validité jours", "Droits"]), ...plans.map((item) => [item.name, item.planKind, item.price / 100, item.activationPolicy, item.validityDays, item.entitlements.map((right) => right.type === "CLASS_SESSIONS" ? `${right.sport?.name ?? item.sport?.name}: ${right.grantedUnits} séances` : right.gymAccessMode === "UNLIMITED" ? "Salle illimitée" : `Salle : ${right.grantedUnits} visites`).join(" | ")]), [], header(["Groupe", "Discipline", "Type", "Genre", "Places disponibles"]), ...catalog.groups.map((group) => [group.name, group.sport.name, group.groupType, group.genderPolicy, Math.max(0, group.capacity - group._count.members)])], columns: Array.from({ length: 6 }, () => ({ width: 32 })), stickyRowsCount: 1 },
    { sheet: "Guide", data: [header(["Champ", "Consigne"]),
      ["Import", "Remplir seulement la première feuille. Maximum 200 élèves. Retirer la ligne préremplie si elle n'est pas utilisée."],
      ["Type membre / Genre", "ADULT, KID ou NOT_SPECIFIED ; MALE, FEMALE ou NOT_SPECIFIED. Les choix français adulte/enfant, homme/femme fonctionnent aussi."],
      ["Téléphone", "Format texte, garder les zéros initiaux. Chaque adulte a un téléphone unique. Pour un enfant, téléphone parent requis ; des frères et sœurs peuvent partager celui du parent."],
      ["Formule", "Nom exact du catalogue. Le type choisi (arts martiaux, salle ou mixte) doit correspondre."],
      ["Groupes", "Un groupe compatible par discipline. Séparer plusieurs groupes par |. Pour une formule salle seule : vide."],
      ["Restant <discipline>", "Nombre entier de séances réellement restantes à la date de reprise, entre zéro et le quota de la formule."],
      ["Visites restantes", "Nombre entier uniquement pour une formule à quota. Laisser vide pour accès illimité."],
      ["Dates", "AAAA-MM-JJ ou JJ/MM/AAAA. Date début au plus tard à la reprise. Date fin au moins égale à la reprise."],
      ["Activation", "ACTIF pour une reprise déjà activée. ATTENTE pour première entrée uniquement : date fin vide et quota complet. Début = date de vente en ATTENTE, date d'activation en ACTIF."],
      ["Montant total / Déjà payé", "Montants dans la monnaie du club, deux décimales maximum. Total vide = prix de la formule. Payé vide = zéro. Le total comprend toute assurance historique ; aucun supplément automatique."],
      ["Assurance", "Montant assurance déjà compris dans le total et le payé + date de début de couverture. Les deux champs ensemble, ou les deux vides."],
      ["Validation", "Prévisualisation obligatoire. Si une ligne est invalide, rien n'est importé. Les doublons et changements depuis la vérification sont refusés."],
    ], columns: [{ width: 30 }, { width: 110 }], stickyRowsCount: 1 },
  ]).toBuffer();
}
