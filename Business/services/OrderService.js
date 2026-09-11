import { withTenant } from "../../database/transaction.js";
import * as Order from "../../models/pg/Order.js";
import * as Reservation from "../../models/pg/Reservation.js";
import * as Client from "../../models/pg/Client.js";
import * as TenantSettings from "../../models/pg/TenantSettings.js";
import * as MongoImport from "../../models/pg/MongoImport.js";
import { resolveCatalogPrice } from "./MenuCatalogService.js";
import * as OpeningHours from "../../models/pg/OpeningHours.js";
import * as EstablishmentProfile from "../../models/pg/EstablishmentProfile.js";
import { hoursToLegacy } from "../mappers/pricingMapper.js";
import { slotKindForTime } from "../validators/businessRules.js";
import { splitInTimeZone } from "../../utils/timeZone.js";
import { commandesToItems, orderToLegacy, reservationToLegacy } from "../mappers/orderMapper.js";
import {
  createdByFromSource,
  mapOrderStatusToPg,
  mapReservationStatusToPg,
  sourceFromCreatedBy,
} from "../mappers/legacyStatus.js";
import {
  assertCapacity,
  assertHhmm,
  assertPartySize,
  assertPhone,
  BusinessRuleError,
  digitsOnly,
} from "../validators/businessRules.js";
import { toYmd, zonedTimeToUtc } from "../../utils/timeZone.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECENT_DUPLICATE_WINDOW_MS = 30 * 60 * 1000;

function resolveTenantId(instanceId) {
  const id = instanceId != null ? String(instanceId).trim() : "";
  if (!UUID_PATTERN.test(id)) {
    throw new BusinessRuleError("Identifiant d'établissement invalide");
  }
  return id;
}

function handleAsapDateTime(date, heure, prepMinutes = 30) {
  let orderDate = date === "ASAP" || !date ? new Date() : new Date(date);
  let orderHeure = heure;
  if (heure === "ASAP") {
    const now = new Date();
    now.setMinutes(now.getMinutes() + prepMinutes);
    orderHeure = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }
  return { orderDate, orderHeure };
}

async function timezoneOf(client, tenantId) {
  const settings = await TenantSettings.find(client, tenantId);
  return settings?.timezone || "Europe/Paris";
}

export class OrderService {
  static digitsOnly(phone) {
    return digitsOnly(phone);
  }

  static async findRecentReservation({ instanceId, telephone, date, heure }) {
    const tenantId = resolveTenantId(instanceId);
    const phone = digitsOnly(telephone);
    if (phone.length < 10 || !heure) return null;
    return withTenant(tenantId, async (client) => {
      const timeZone = await timezoneOf(client, tenantId);
      const ymd = toYmd(date);
      const from = zonedTimeToUtc(ymd, "00:00", timeZone);
      const to = new Date(from);
      to.setUTCDate(to.getUTCDate() + 1);
      const exact = zonedTimeToUtc(ymd, heure, timeZone);
      const since = new Date(Date.now() - RECENT_DUPLICATE_WINDOW_MS);
      const found = await Reservation.findRecentDuplicate(client, tenantId, {
        phone,
        from,
        to,
        since,
      });
      if (!found) return null;
      const reserved = new Date(found.reservedAt).getTime();
      if (Math.abs(reserved - exact.getTime()) > 60 * 1000) return found;
      return reservationToLegacy(found, timeZone);
    });
  }

  static async findRecentOrder({ instanceId, telephone, date, heure }) {
    const tenantId = resolveTenantId(instanceId);
    const phone = digitsOnly(telephone);
    if (phone.length < 10 || !heure) return null;
    return withTenant(tenantId, async (client) => {
      const timeZone = await timezoneOf(client, tenantId);
      const ymd = toYmd(date);
      const from = zonedTimeToUtc(ymd, "00:00", timeZone);
      const to = new Date(from);
      to.setUTCDate(to.getUTCDate() + 1);
      const since = new Date(Date.now() - RECENT_DUPLICATE_WINDOW_MS);
      const found = await Order.findRecentDuplicate(client, tenantId, {
        phone,
        from,
        to,
        since,
      });
      return found ? orderToLegacy(found, timeZone) : null;
    });
  }

  static async createReservationFromData(reservationData, options = {}) {
    const tenantId = resolveTenantId(options.instanceId);
    const { orderDate, orderHeure } = handleAsapDateTime(
      reservationData.date,
      reservationData.heure
    );
    const existing = await this.findRecentReservation({
      instanceId: tenantId,
      telephone: reservationData.telephone,
      date: orderDate,
      heure: orderHeure,
    });
    if (existing) return existing;
    return this.createReservation(tenantId, {
      ...reservationData,
      date: orderDate,
      heure: orderHeure,
      createdBy: "system",
      relatedCall: options.callId || null,
    });
  }

  static async createOrderFromAppointment(orderData, options = {}) {
    const tenantId = resolveTenantId(options.instanceId);
    const { orderDate, orderHeure } = handleAsapDateTime(orderData.date, orderData.heure);
    const existing = await this.findRecentOrder({
      instanceId: tenantId,
      telephone: options.telephone || orderData.telephone,
      date: orderDate,
      heure: orderHeure,
    });
    if (existing) return existing;
    return this.createOrder(tenantId, {
      ...orderData,
      nom: options.nom || orderData.nom,
      telephone: options.telephone || orderData.telephone,
      date: orderDate,
      heure: orderHeure,
      createdBy: "system",
      relatedCall: options.callId || null,
    });
  }

  static async createOrder(tenantId, payload, { enforceCatalog = true } = {}) {
    const id = resolveTenantId(tenantId);
    return withTenant(id, async (client) => {
      const settings = await TenantSettings.find(client, id);
      const timeZone = settings?.timezone || "Europe/Paris";
      const heure = payload.heure ? assertHhmm(payload.heure) : assertHhmm("12:00");
      const ymd = toYmd(payload.date) || toYmd(new Date());
      const pickupAt = zonedTimeToUtc(ymd, heure, timeZone);
      let items = commandesToItems(payload.commandes || payload.items || []);
      if (enforceCatalog && items.length) {
        items = await Promise.all(
          (payload.commandes || payload.items || []).map((line) =>
            resolveCatalogPrice(client, id, line)
          )
        );
      }
      const totalCents = items.reduce(
        (sum, item) => sum + item.unitPriceCents * item.quantity,
        0
      );
      let clientId = payload.clientId || null;
      if (payload.telephone && payload.telephone !== "Non fourni") {
        const guest = await Client.upsertByPhone(client, id, {
          phone: String(payload.telephone).trim(),
          name: payload.nom || null,
          firstName: payload.prenom || null,
          lastName: payload.nom || null,
        });
        clientId = guest.id;
      }
      const created = await Order.create(client, id, {
        clientId,
        status: mapOrderStatusToPg(payload.statut || "confirme"),
        source: sourceFromCreatedBy(payload.createdBy),
        totalCents,
        pickupAt,
        notes: payload.notes || payload.description || null,
        guestName: payload.nom || null,
        guestPhone: payload.telephone || null,
        legacyStatus: payload.statut || "confirme",
        createdBy: createdByFromSource(payload.source, payload.createdBy),
        relatedCall: payload.relatedCall || payload.related_call || null,
        items,
        legacyPayload: payload,
      });
      return orderToLegacy(created, timeZone);
    });
  }

  static async createReservation(tenantId, payload) {
    const id = resolveTenantId(tenantId);
    const partySize = assertPartySize(payload.nombrePersonnes ?? payload.partySize ?? 1);
    const heure = assertHhmm(payload.heure);
    return withTenant(id, async (client) => {
      const settings = await TenantSettings.find(client, id);
      const timeZone = settings?.timezone || "Europe/Paris";
      const ymd = toYmd(payload.date) || toYmd(new Date());
      const reservedAt = zonedTimeToUtc(ymd, heure, timeZone);
      const remaining = await remainingCoversInTx(client, id, ymd, heure, timeZone);
      assertCapacity(partySize, remaining);
      let clientId = payload.clientId || null;
      if (payload.telephone && payload.telephone !== "Non fourni") {
        assertPhone(payload.telephone, { required: false });
        const guest = await Client.upsertByPhone(client, id, {
          phone: String(payload.telephone).trim(),
          name: payload.nom || payload.name || null,
        });
        clientId = guest.id;
      }
      const created = await Reservation.create(client, id, {
        clientId,
        partySize,
        reservedAt,
        status: mapReservationStatusToPg(payload.statut || "confirme"),
        source: sourceFromCreatedBy(payload.createdBy),
        notes: payload.notes || payload.description || null,
        guestName: payload.nom || payload.name || null,
        guestPhone: payload.telephone || null,
        description: payload.description || "",
        internalNotes: payload.notes_internes || payload.internalNotes || "",
        legacyStatus: payload.statut || "confirme",
        createdBy: createdByFromSource(payload.source, payload.createdBy),
        relatedCall: payload.relatedCall || payload.related_call || null,
        legacyPayload: payload,
      });
      return reservationToLegacy(created, timeZone);
    });
  }

  static async resolveLegacyId(tenantId, collection, rawId) {
    if (UUID_PATTERN.test(rawId)) return rawId;
    return withTenant(tenantId, (client) => MongoImport.findRef(client, tenantId, collection, rawId));
  }

  static async searchOrders() {
    return [];
  }

  static async getOrdersByClient() {
    return [];
  }
}

async function remainingCoversInTx(client, tenantId, ymd, heure, timeZone) {
  const profile = await EstablishmentProfile.findByTenantId(tenantId, client);
  const maxCouverts = profile?.seatCount;
  if (!maxCouverts) return null;
  const hours = await OpeningHours.list(client, tenantId);
  const dayName = [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
  ][new Date(`${ymd}T00:00:00`).getDay()];
  const dayHours = hoursToLegacy(hours)[dayName];
  const kind = slotKindForTime(heure, dayHours);
  const from = zonedTimeToUtc(ymd, "00:00", timeZone);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);
  const listed = await Reservation.list(client, tenantId, { from, to, limit: 500 });
  const used = listed.rows
    .filter((row) => row.status !== "cancelled")
    .filter((row) => slotKindForTime(splitInTimeZone(row.reservedAt, timeZone).heure, dayHours) === kind)
    .reduce((sum, row) => sum + row.partySize, 0);
  return Math.max(0, maxCouverts - used);
}

export { resolveTenantId };
