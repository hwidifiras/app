export const APP_CURRENCY_CODE = "TND";
export const MONEY_INPUT_SUFFIX = "TND";

export function formatMoney(cents: number) {
  const amount = cents / 100;
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${formatted} ${APP_CURRENCY_CODE}`;
}

export function formatMoneyFromMajorInput(value: string | number | null | undefined) {
  const normalized =
    typeof value === "number" ? value : Number(String(value ?? "0").trim().replace(",", "."));
  const safeValue = Number.isFinite(normalized) ? normalized : 0;

  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeValue)} ${APP_CURRENCY_CODE}`;
}
