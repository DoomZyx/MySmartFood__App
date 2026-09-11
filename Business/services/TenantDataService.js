import { withTenant } from "../../database/transaction.js";
import * as Client from "../../models/pg/Client.js";
import { OrderService } from "./OrderService.js";
import * as Booking from "./TenantBookingService.js";
import { clientToLegacy } from "../mappers/orderMapper.js";

export function listClients(tenantId) {
  return withTenant(tenantId, async (client) => {
    const rows = await Client.list(client, tenantId);
    return rows.map(clientToLegacy);
  });
}

export function listOrders(tenantId) {
  return Booking.listOrders(tenantId, { limit: 200 }).then((result) => result.data);
}

export function createOrder(tenantId, data) {
  return OrderService.createOrder(tenantId, data);
}

export function listReservations(tenantId) {
  return Booking.listReservations(tenantId, { limit: 200 }).then((result) => result.data);
}

export function createReservation(tenantId, data) {
  return OrderService.createReservation(tenantId, data);
}

export function upsertClient(tenantId, data) {
  return withTenant(tenantId, (client) =>
    Client.upsertByPhone(client, tenantId, {
      phone: data.phone || data.telephone,
      name: data.name || [data.prenom, data.nom].filter(Boolean).join(" "),
      firstName: data.firstName || data.prenom,
      lastName: data.lastName || data.nom,
      email: data.email,
      address: data.address || data.adresse,
      company: data.company || data.entrepriseName,
      clientType: data.clientType || data.type || "client",
    })
  );
}
