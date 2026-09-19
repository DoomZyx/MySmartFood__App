import { PricingService } from "./PricingService.js";
import { BusinessRuleError, slotKindForTime } from "../validators/businessRules.js";
import { withTenant } from "../../database/transaction.js";
import * as TenantSettings from "../../models/pg/TenantSettings.js";
import { DAYS_FR, weekdayIndexFromYmd } from "../../utils/timeZone.js";

const DAY_ORDER = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

function capitalizeDay(day) {
  return day ? `${day.charAt(0).toUpperCase()}${day.slice(1)}` : "";
}

function dayHasSlot(block) {
  if (!block || block.ouvert === false) return false;
  return ["midi", "soir"].some(
    (kind) => block[kind]?.ouverture && block[kind]?.fermeture
  );
}

export function hasConfiguredHours(horaires) {
  if (!horaires || typeof horaires !== "object") return false;
  return Object.values(horaires).some(dayHasSlot);
}

export function formatHoursForVoiceTools(horaires) {
  const header =
    "Les plages viennent exclusivement des horaires du restaurant. " +
    "N'invente jamais de plage hors de ces donnees.";
  if (!horaires || typeof horaires !== "object") {
    return header;
  }

  const lines = DAY_ORDER.map((day) => {
    const block = horaires[day];
    if (!dayHasSlot(block)) {
      return `${capitalizeDay(day)}: ferme`;
    }
    const parts = [];
    for (const kind of ["midi", "soir"]) {
      const slot = block[kind];
      if (slot?.ouverture && slot?.fermeture) {
        parts.push(`${slot.ouverture}-${slot.fermeture}`);
      }
    }
    return `${capitalizeDay(day)}: ${parts.join(" et ")}`;
  });

  return `${header} ${lines.join(" ")}`;
}

export function assertTimeInOpeningHours({
  horaires,
  dateYmd,
  hhmm,
  timeZone = "Europe/Paris",
} = {}) {
  if (!hasConfiguredHours(horaires)) return;
  const weekdayIndex = weekdayIndexFromYmd(dateYmd, timeZone);
  const dayName = DAYS_FR[weekdayIndex];
  const dayHours = horaires[dayName];
  if (!dayHours?.ouvert || !slotKindForTime(hhmm, dayHours)) {
    throw new BusinessRuleError("Heure hors horaires d'ouverture.");
  }
}

export async function assertAiAppointmentHours(tenantId, dateYmd, hhmm) {
  const horaires = await PricingService.getOpeningHours(tenantId);
  const timeZone = await withTenant(tenantId, async (client) => {
    const settings = await TenantSettings.find(client, tenantId);
    return settings?.timezone || "Europe/Paris";
  });
  assertTimeInOpeningHours({ horaires, dateYmd, hhmm, timeZone });
}
