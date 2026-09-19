import { withTenant } from "../../database/transaction.js";
import * as OpeningHours from "../../models/pg/OpeningHours.js";
import * as EstablishmentProfile from "../../models/pg/EstablishmentProfile.js";
import * as TenantSettings from "../../models/pg/TenantSettings.js";
import { hoursToLegacy } from "../mappers/pricingMapper.js";
import { mapOrderStatusToFr, mapReservationStatusToFr } from "../mappers/legacyStatus.js";
import {
  DAYS_FR,
  minutesOf,
  splitInTimeZone,
  weekdayIndexFromYmd,
  zonedTimeToUtc,
} from "../../utils/timeZone.js";

const TODAY_CAP = 200;

const ORDER_STATUS_LABELS = {
  confirme: "Confirmée",
  en_cours: "En préparation",
  planifie: "Planifiée",
  termine: "Prête",
  reporte: "Reportée",
};

export function getCurrentService(horairesOuverture, dayName, nowMinutes) {
  const horaire = horairesOuverture?.[dayName];
  if (!horaire || horaire.ouvert === false) return null;

  if (horaire.midi?.ouverture && horaire.midi?.fermeture) {
    const start = minutesOf(horaire.midi.ouverture);
    const end = minutesOf(horaire.midi.fermeture);
    if (nowMinutes >= start && nowMinutes <= end) {
      return { service: "midi", start, end };
    }
  }
  if (horaire.soir?.ouverture && horaire.soir?.fermeture) {
    const start = minutesOf(horaire.soir.ouverture);
    const end = minutesOf(horaire.soir.fermeture);
    if (nowMinutes >= start && nowMinutes <= end) {
      return { service: "soir", start, end };
    }
  }
  return null;
}

export function inServiceWindow(heure, currentService) {
  if (!currentService) return false;
  const minutes = minutesOf(heure);
  if (!Number.isFinite(minutes)) return false;
  return minutes >= currentService.start && minutes <= currentService.end;
}

export function mapOrderToActive(order) {
  const id = order.id ? String(order.id).slice(-6) : "";
  const status = ORDER_STATUS_LABELS[order.statut] || order.statut;
  return {
    id,
    client: order.nom || "—",
    type: "takeaway",
    status,
    time: order.heure || "—",
  };
}

export function mapReservationToActive(reservation) {
  return {
    time: reservation.heure || "—",
    guests: reservation.nombrePersonnes ?? 1,
    table: null,
  };
}

export function buildRadarEvents(orders, reservations, nowMinutes, windowMinutes = 60) {
  const events = [];
  const endMinutes = nowMinutes + windowMinutes;

  for (const reservation of reservations) {
    if (reservation.statut === "annule" || reservation.statut === "termine") continue;
    const eventMin = minutesOf(reservation.heure);
    if (!Number.isFinite(eventMin) || eventMin < nowMinutes || eventMin > endMinutes) continue;
    events.push({
      time: reservation.heure,
      type: "reservation",
      guests: reservation.nombrePersonnes ?? 1,
    });
  }
  for (const order of orders) {
    if (order.statut === "annule") continue;
    const eventMin = minutesOf(order.heure);
    if (!Number.isFinite(eventMin) || eventMin < nowMinutes || eventMin > endMinutes) continue;
    events.push({ time: order.heure, type: "takeaway" });
  }

  events.sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
  return events.slice(0, 6);
}

export function occupiedCovers(reservations, currentService) {
  if (!currentService) return 0;
  return reservations
    .filter((reservation) => {
      if (reservation.statut === "annule" || reservation.statut === "termine") return false;
      return inServiceWindow(reservation.heure, currentService);
    })
    .reduce((sum, reservation) => sum + (Number(reservation.nombrePersonnes) || 0), 0);
}

export function assembleTodayDashboard({
  orders,
  reservations,
  currentService,
  nowMinutes,
  totalCapacity,
}) {
  const ordersForService = currentService
    ? orders.filter((order) => order.statut !== "annule" && inServiceWindow(order.heure, currentService))
    : [];
  const reservationsForService = currentService
    ? reservations.filter(
        (reservation) =>
          reservation.statut !== "annule" &&
          reservation.statut !== "termine" &&
          inServiceWindow(reservation.heure, currentService)
      )
    : [];
  const occupied = Math.min(occupiedCovers(reservations, currentService), totalCapacity);

  return {
    activeOrders: ordersForService.map(mapOrderToActive),
    activeReservations: reservationsForService.map(mapReservationToActive),
    radarEvents: buildRadarEvents(ordersForService, reservationsForService, nowMinutes, 60),
    capacity: { occupied, total: totalCapacity },
    agentStats: {
      callsHandled: orders.length + reservations.length,
      ordersCreated: orders.length,
      reservationsCreated: reservations.length,
    },
  };
}

async function loadVenueWithClient(client, tenantId) {
  const settings = await TenantSettings.find(client, tenantId);
  const hours = await OpeningHours.list(client, tenantId);
  const profile = await EstablishmentProfile.findByTenantId(tenantId, client);
  return {
    timeZone: settings?.timezone || "Europe/Paris",
    horairesOuverture: hoursToLegacy(hours),
    nombreCouverts: profile?.seatCount || 0,
  };
}

export async function getDashboardVenue(tenantId) {
  return withTenant(tenantId, async (client) => {
    const venue = await loadVenueWithClient(client, tenantId);
    return {
      horairesOuverture: venue.horairesOuverture,
      nombreCouverts: venue.nombreCouverts,
    };
  });
}

export async function getDashboardToday(tenantId) {
  return withTenant(tenantId, async (client) => {
    const venue = await loadVenueWithClient(client, tenantId);
    const now = new Date();
    const { date: todayYmd, heure: nowHeure } = splitInTimeZone(now, venue.timeZone);
    const from = zonedTimeToUtc(todayYmd, "00:00", venue.timeZone);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);
    const nowMinutes = minutesOf(nowHeure);
    const dayName = DAYS_FR[weekdayIndexFromYmd(todayYmd, venue.timeZone)];
    const currentService = getCurrentService(venue.horairesOuverture, dayName, nowMinutes);

    const ordersResult = await client.query(
      `SELECT id, guest_name, pickup_at, status, legacy_status
         FROM orders
        WHERE tenant_id = $1 AND pickup_at >= $2 AND pickup_at < $3
        ORDER BY pickup_at ASC NULLS LAST
        LIMIT $4`,
      [tenantId, from, to, TODAY_CAP]
    );
    const reservationsResult = await client.query(
      `SELECT id, guest_name, reserved_at, party_size, status, legacy_status
         FROM reservations
        WHERE tenant_id = $1 AND reserved_at >= $2 AND reserved_at < $3
        ORDER BY reserved_at ASC
        LIMIT $4`,
      [tenantId, from, to, TODAY_CAP]
    );

    const orders = ordersResult.rows.map((row) => {
      const split = row.pickup_at ? splitInTimeZone(row.pickup_at, venue.timeZone) : { heure: null };
      return {
        id: row.id,
        nom: row.guest_name,
        heure: split.heure,
        statut: mapOrderStatusToFr(row.status, row.legacy_status),
      };
    });
    const reservations = reservationsResult.rows.map((row) => {
      const split = row.reserved_at
        ? splitInTimeZone(row.reserved_at, venue.timeZone)
        : { heure: null };
      return {
        id: row.id,
        nom: row.guest_name,
        heure: split.heure,
        statut: mapReservationStatusToFr(row.status, row.legacy_status),
        nombrePersonnes: row.party_size,
      };
    });

    return assembleTodayDashboard({
      orders,
      reservations,
      currentService,
      nowMinutes,
      totalCapacity: venue.nombreCouverts,
    });
  });
}
