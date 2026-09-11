import { withTenant } from "../../database/transaction.js";
import * as OpeningHours from "../../models/pg/OpeningHours.js";
import * as Reservation from "../../models/pg/Reservation.js";
import * as Order from "../../models/pg/Order.js";
import * as EstablishmentProfile from "../../models/pg/EstablishmentProfile.js";
import * as TenantSettings from "../../models/pg/TenantSettings.js";
import { hoursToLegacy } from "../mappers/pricingMapper.js";
import { formatMinutes, minutesOf, splitInTimeZone, toYmd, zonedTimeToUtc } from "../../utils/timeZone.js";
import { isTimeInSlot, slotKindForTime } from "../validators/businessRules.js";

function slotsFromDay(dayHours, step = 30) {
  const slots = [];
  for (const kind of ["midi", "soir"]) {
    const slot = dayHours?.[kind];
    if (!slot?.ouverture || !slot?.fermeture) continue;
    let current = minutesOf(slot.ouverture);
    const end = minutesOf(slot.fermeture);
    if (end > current) {
      while (current < end) {
        slots.push(formatMinutes(current));
        current += step;
      }
    } else {
      while (current < 24 * 60) {
        slots.push(formatMinutes(current));
        current += step;
      }
      current = 0;
      while (current < end) {
        slots.push(formatMinutes(current));
        current += step;
      }
    }
  }
  return slots;
}

export async function loadDayContext(tenantId, dateYmd) {
  return withTenant(tenantId, async (client) => {
    const [hours, settings, profile] = await Promise.all([
      OpeningHours.list(client, tenantId),
      TenantSettings.find(client, tenantId),
      EstablishmentProfile.findByTenantId(tenantId, client),
    ]);
    const timeZone = settings?.timezone || "Europe/Paris";
    const horaires = hoursToLegacy(hours);
    const date = new Date(`${dateYmd}T12:00:00`);
    const dayIndex = new Date(
      zonedTimeToUtc(dateYmd, "12:00", timeZone)
    ).toLocaleString("en-US", { timeZone, weekday: "short" });
    const jsDay = zonedTimeToUtc(dateYmd, "12:00", timeZone).getUTCDay();
    const localMid = zonedTimeToUtc(dateYmd, "12:00", timeZone);
    const weekday = new Date(
      localMid.toLocaleString("en-US", { timeZone })
    ).getDay();
    void date;
    void dayIndex;
    void jsDay;
    const jours = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    const weekdayIndex = weekday;
    const dayName = jours[weekdayIndex];
    const dayHours = horaires[dayName];
    return { client, timeZone, horaires, dayHours, dayName, settings, profile, weekdayIndex };
  });
}

export function isOpenNow(horaires, timeZone = "Europe/Paris") {
  const now = splitInTimeZone(new Date(), timeZone);
  const date = new Date(`${now.date}T12:00:00`);
  const dayName = [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
  ][date.getDay()];
  const dayHours = horaires?.[dayName];
  if (!dayHours?.ouvert) return false;
  return Boolean(slotKindForTime(now.heure, dayHours));
}

export async function getOrderSlots(tenantId, dateYmd) {
  return withTenant(tenantId, async (client) => {
    const settings = await TenantSettings.find(client, tenantId);
    const timeZone = settings?.timezone || "Europe/Paris";
    const hours = await OpeningHours.list(client, tenantId);
    const horaires = hoursToLegacy(hours);
    const weekday = zonedTimeToUtc(dateYmd, "12:00", timeZone);
    const dayName = [
      "dimanche",
      "lundi",
      "mardi",
      "mercredi",
      "jeudi",
      "vendredi",
      "samedi",
    ][new Date(`${dateYmd}T12:00:00Z`).getUTCDay()];
    const local = new Date(weekday.toLocaleString("en-US", { timeZone }));
    void local;
    const jsDay = new Date(`${dateYmd}T00:00:00`).getDay();
    const resolvedDay = [
      "dimanche",
      "lundi",
      "mardi",
      "mercredi",
      "jeudi",
      "vendredi",
      "samedi",
    ][jsDay];
    const dayHours = horaires[resolvedDay];
    if (!dayHours?.ouvert) {
      return { availableSlots: [], occupiedSlots: [], message: "Restaurant fermé ce jour-là", horaires };
    }
    const step = settings?.reservationSlotMinutes || 30;
    const slots = slotsFromDay(dayHours, step);
    const from = zonedTimeToUtc(dateYmd, "00:00", timeZone);
    const to = zonedTimeToUtc(toYmd(new Date(from.getTime() + 36 * 3600 * 1000)) || dateYmd, "00:00", timeZone);
    const nextDay = new Date(from);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const listed = await Order.list(client, tenantId, {
      from,
      to: nextDay,
      limit: 500,
    });
    const occupiedSlots = listed.rows
      .filter((row) => row.status !== "cancelled" && row.status !== "completed")
      .map((row) => splitInTimeZone(row.pickupAt, timeZone).heure);
    return {
      availableSlots: slots.filter((slot) => !occupiedSlots.includes(slot)),
      occupiedSlots,
      horaires,
      dayHours,
    };
  });
}

export async function getReservationSlots(tenantId, dateYmd) {
  return withTenant(tenantId, async (client) => {
    const settings = await TenantSettings.find(client, tenantId);
    const profile = await EstablishmentProfile.findByTenantId(tenantId, client);
    const timeZone = settings?.timezone || "Europe/Paris";
    const hours = await OpeningHours.list(client, tenantId);
    const horaires = hoursToLegacy(hours);
    const jsDay = new Date(`${dateYmd}T00:00:00`).getDay();
    const dayName = [
      "dimanche",
      "lundi",
      "mardi",
      "mercredi",
      "jeudi",
      "vendredi",
      "samedi",
    ][jsDay];
    const dayHours = horaires[dayName];
    const maxCouverts = profile?.seatCount || null;
    if (!dayHours?.ouvert) {
      return {
        availableSlots: [],
        occupiedSlots: [],
        remainingCoversMidi: maxCouverts,
        remainingCoversSoir: maxCouverts,
        message: "Restaurant fermé ce jour-là",
      };
    }
    const step = settings?.reservationSlotMinutes || 30;
    const slots = slotsFromDay(dayHours, step);
    const from = zonedTimeToUtc(dateYmd, "00:00", timeZone);
    const nextDay = new Date(from);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const listed = await Reservation.list(client, tenantId, {
      from,
      to: nextDay,
      limit: 500,
    });
    const active = listed.rows.filter((row) => row.status !== "cancelled");
    const occupiedSlots = active.map((row) => splitInTimeZone(row.reservedAt, timeZone).heure);
    let couvertsMidi = 0;
    let couvertsSoir = 0;
    for (const row of active) {
      const heure = splitInTimeZone(row.reservedAt, timeZone).heure;
      const kind = slotKindForTime(heure, dayHours);
      if (kind === "midi") couvertsMidi += row.partySize;
      if (kind === "soir") couvertsSoir += row.partySize;
    }
    return {
      availableSlots: slots.filter((slot) => !occupiedSlots.includes(slot)),
      occupiedSlots,
      remainingCoversMidi: maxCouverts == null ? null : Math.max(0, maxCouverts - couvertsMidi),
      remainingCoversSoir: maxCouverts == null ? null : Math.max(0, maxCouverts - couvertsSoir),
      maxCouverts,
      dayHours,
    };
  });
}

export async function remainingCoversForSlot(tenantId, dateYmd, hhmm) {
  const slots = await getReservationSlots(tenantId, dateYmd);
  const kind = slotKindForTime(hhmm, slots.dayHours);
  if (kind === "soir") return slots.remainingCoversSoir;
  return slots.remainingCoversMidi;
}

export { isTimeInSlot };
