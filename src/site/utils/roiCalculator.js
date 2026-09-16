const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;
export const STARTER_PLAN_EUROS = 150;

export function computeRoi(averageBasket, missedCallsPerWeek) {
  const basket = Math.max(0, Number(averageBasket) || 0);
  const calls = Math.max(0, Number(missedCallsPerWeek) || 0);
  const weekly = basket * calls;
  const yearly = weekly * WEEKS_PER_YEAR;
  const monthly = yearly / MONTHS_PER_YEAR;
  const planCovered = monthly >= STARTER_PLAN_EUROS;
  return { basket, calls, weekly, monthly, yearly, planCovered };
}

export function formatEuros(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}
