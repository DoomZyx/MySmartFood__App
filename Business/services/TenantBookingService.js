import { withTenant } from "../../database/transaction.js";
import * as Order from "../../models/pg/Order.js";
import * as Reservation from "../../models/pg/Reservation.js";
import * as TenantSettings from "../../models/pg/TenantSettings.js";
import * as MongoImport from "../../models/pg/MongoImport.js";
import { OrderService } from "./OrderService.js";
import { orderToLegacy, reservationToLegacy } from "../mappers/orderMapper.js";
import { mapOrderStatusToPg, mapReservationStatusToPg } from "../mappers/legacyStatus.js";
import { BusinessRuleError } from "../validators/businessRules.js";
import { toYmd, zonedTimeToUtc } from "../../utils/timeZone.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveId(client, tenantId, collection, rawId) {
  if (UUID_PATTERN.test(rawId)) return rawId;
  const mapped = await MongoImport.findRef(client, tenantId, collection, rawId);
  if (!mapped) throw new BusinessRuleError("Ressource non trouvée", 404);
  return mapped;
}

export async function listOrders(tenantId, query = {}) {
  return withTenant(tenantId, async (client) => {
    const timeZone = (await TenantSettings.find(client, tenantId))?.timezone || "Europe/Paris";
    const range = dateRange(query.date, timeZone);
    const result = await Order.list(client, tenantId, {
      legacyStatus: query.statut,
      from: range?.from,
      to: range?.to,
      page: query.page,
      limit: query.limit,
    });
    return {
      data: result.rows.map((row) => orderToLegacy(row, timeZone)),
      total: result.total,
    };
  });
}

export async function listReservations(tenantId, query = {}) {
  return withTenant(tenantId, async (client) => {
    const timeZone = (await TenantSettings.find(client, tenantId))?.timezone || "Europe/Paris";
    const range = dateRange(query.date, timeZone);
    const result = await Reservation.list(client, tenantId, {
      legacyStatus: query.statut,
      from: range?.from,
      to: range?.to,
      page: query.page,
      limit: query.limit,
    });
    return {
      data: result.rows.map((row) => reservationToLegacy(row, timeZone)),
      total: result.total,
    };
  });
}

export async function getOrder(tenantId, rawId) {
  return withTenant(tenantId, async (client) => {
    const timeZone = (await TenantSettings.find(client, tenantId))?.timezone || "Europe/Paris";
    const id = await resolveId(client, tenantId, "orders", rawId);
    const row = await Order.findById(client, tenantId, id);
    if (!row) throw new BusinessRuleError("Commande non trouvée", 404);
    return orderToLegacy(row, timeZone);
  });
}

export async function getReservation(tenantId, rawId) {
  return withTenant(tenantId, async (client) => {
    const timeZone = (await TenantSettings.find(client, tenantId))?.timezone || "Europe/Paris";
    const id = await resolveId(client, tenantId, "reservations", rawId);
    const row = await Reservation.findById(client, tenantId, id);
    if (!row) throw new BusinessRuleError("Réservation non trouvée", 404);
    return reservationToLegacy(row, timeZone);
  });
}

export async function updateOrder(tenantId, rawId, body) {
  return withTenant(tenantId, async (client) => {
    const timeZone = (await TenantSettings.find(client, tenantId))?.timezone || "Europe/Paris";
    const id = await resolveId(client, tenantId, "orders", rawId);
    const pickupAt =
      body.date && body.heure
        ? zonedTimeToUtc(toYmd(body.date), body.heure, timeZone)
        : null;
    const row = await Order.update(client, tenantId, id, {
      status: body.statut ? mapOrderStatusToPg(body.statut) : undefined,
      legacyStatus: body.statut,
      pickupAt,
      notes: body.notes || body.description,
      guestName: body.nom,
      guestPhone: body.telephone,
    });
    if (!row) throw new BusinessRuleError("Commande non trouvée", 404);
    return orderToLegacy(row, timeZone);
  });
}

export async function updateReservation(tenantId, rawId, body) {
  return withTenant(tenantId, async (client) => {
    const timeZone = (await TenantSettings.find(client, tenantId))?.timezone || "Europe/Paris";
    const id = await resolveId(client, tenantId, "reservations", rawId);
    const reservedAt =
      body.date && body.heure
        ? zonedTimeToUtc(toYmd(body.date), body.heure, timeZone)
        : null;
    const row = await Reservation.update(client, tenantId, id, {
      partySize: body.nombrePersonnes,
      reservedAt,
      status: body.statut ? mapReservationStatusToPg(body.statut) : undefined,
      legacyStatus: body.statut,
      guestName: body.nom,
      guestPhone: body.telephone,
      description: body.description,
      internalNotes: body.notes_internes,
    });
    if (!row) throw new BusinessRuleError("Réservation non trouvée", 404);
    return reservationToLegacy(row, timeZone);
  });
}

export async function deleteOrder(tenantId, rawId) {
  return withTenant(tenantId, async (client) => {
    const id = await resolveId(client, tenantId, "orders", rawId);
    const ok = await Order.remove(client, tenantId, id);
    if (!ok) throw new BusinessRuleError("Commande non trouvée", 404);
  });
}

export async function deleteReservation(tenantId, rawId) {
  return withTenant(tenantId, async (client) => {
    const id = await resolveId(client, tenantId, "reservations", rawId);
    const ok = await Reservation.remove(client, tenantId, id);
    if (!ok) throw new BusinessRuleError("Réservation non trouvée", 404);
  });
}

export async function createOrder(tenantId, body) {
  return OrderService.createOrder(tenantId, body);
}

export async function createReservation(tenantId, body) {
  return OrderService.createReservation(tenantId, body);
}

function dateRange(date, timeZone) {
  if (!date) return null;
  const ymd = toYmd(date);
  if (!ymd) return null;
  const from = zonedTimeToUtc(ymd, "00:00", timeZone);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);
  return { from, to };
}
