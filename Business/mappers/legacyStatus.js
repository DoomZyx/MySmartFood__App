const ORDER_TO_PG = {
  planifie: "pending",
  confirme: "confirmed",
  en_cours: "ready",
  termine: "completed",
  annule: "cancelled",
  reporte: "pending",
  pending: "pending",
  confirmed: "confirmed",
  ready: "ready",
  completed: "completed",
  cancelled: "cancelled",
};

const RESERVATION_TO_PG = {
  planifie: "pending",
  confirme: "confirmed",
  en_cours: "seated",
  termine: "completed",
  annule: "cancelled",
  reporte: "pending",
  pending: "pending",
  confirmed: "confirmed",
  seated: "seated",
  completed: "completed",
  cancelled: "cancelled",
  no_show: "no_show",
};

const ORDER_TO_FR = {
  pending: "planifie",
  confirmed: "confirme",
  ready: "en_cours",
  completed: "termine",
  cancelled: "annule",
};

const RESERVATION_TO_FR = {
  pending: "planifie",
  confirmed: "confirme",
  seated: "en_cours",
  completed: "termine",
  cancelled: "annule",
  no_show: "annule",
};

const SOURCE_FROM_CREATED_BY = {
  system: "voice",
  manual: "dashboard",
  calendly: "dashboard",
};

const CREATED_BY_FROM_SOURCE = {
  voice: "system",
  dashboard: "manual",
};

export function mapOrderStatusToPg(status) {
  if (!status) return "confirmed";
  return ORDER_TO_PG[String(status)] || "pending";
}

export function mapReservationStatusToPg(status) {
  if (!status) return "confirmed";
  return RESERVATION_TO_PG[String(status)] || "pending";
}

export function mapOrderStatusToFr(status, legacyStatus) {
  if (legacyStatus) return legacyStatus;
  return ORDER_TO_FR[status] || "confirme";
}

export function mapReservationStatusToFr(status, legacyStatus) {
  if (legacyStatus) return legacyStatus;
  return RESERVATION_TO_FR[status] || "confirme";
}

export function sourceFromCreatedBy(createdBy) {
  return SOURCE_FROM_CREATED_BY[createdBy] || "dashboard";
}

export function createdByFromSource(source, createdBy) {
  if (createdBy) return createdBy;
  return CREATED_BY_FROM_SOURCE[source] || "manual";
}

export function eurosToCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function centsToEuros(cents) {
  return Number((Number(cents || 0) / 100).toFixed(2));
}

export function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "item";
}
