import { OrderService } from "../Business/services/OrderService.js";
import * as Booking from "../Business/services/TenantBookingService.js";
import { getOrderSlots } from "../Business/services/AvailabilityService.js";
import { assertPhone, BusinessRuleError, digitsOnly } from "../Business/validators/businessRules.js";
import { normalizeHhmm, toYmd } from "../utils/timeZone.js";
import logger from "../Services/logging/logger.js";

function tenantIdOf(request) {
  return request.tenant?.id || request.instanceId;
}

function sendError(reply, error) {
  const status = error.statusCode || (error.message?.includes("non trouv") ? 404 : 500);
  logger.error({ err: error?.message }, "Erreur commande");
  return reply.code(status).send({
    error: status === 500 ? "Erreur interne du serveur" : error.message,
    details: error.message,
    remainingCovers: error.remainingCovers,
    requestedCovers: error.requestedCovers,
  });
}

export async function createOrder(request, reply) {
  try {
    const order = await Booking.createOrder(tenantIdOf(request), {
      ...request.body,
      createdBy: request.body.createdBy || "manual",
    });
    return reply.code(201).send({ success: true, data: order });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function getOrders(request, reply) {
  try {
    const page = Number(request.query.page) || 1;
    const limit = Number(request.query.limit) || 10;
    const result = await Booking.listOrders(tenantIdOf(request), {
      ...request.query,
      page,
      limit,
    });
    return reply.send({
      success: true,
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        pages: Math.ceil(result.total / limit) || 1,
      },
    });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function getTodayOrders(request, reply) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = await Booking.listOrders(tenantIdOf(request), {
      date: today,
      limit: 200,
    });
    return reply.send({ success: true, data: result.data });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function getOrderById(request, reply) {
  try {
    const order = await Booking.getOrder(tenantIdOf(request), request.params.id);
    return reply.send({ success: true, data: order });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function updateOrder(request, reply) {
  try {
    const order = await Booking.updateOrder(
      tenantIdOf(request),
      request.params.id,
      request.body
    );
    return reply.send({ success: true, data: order });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function updateOrderStatus(request, reply) {
  try {
    const order = await Booking.updateOrder(tenantIdOf(request), request.params.id, {
      statut: request.body.statut,
    });
    return reply.send({ success: true, data: order });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function deleteOrder(request, reply) {
  try {
    await Booking.deleteOrder(tenantIdOf(request), request.params.id);
    return reply.send({ success: true, message: "Commande supprimée" });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function checkAvailability(request, reply) {
  try {
    const { date, heure } = request.query;
    const slots = await getOrderSlots(tenantIdOf(request), toYmd(date));
    const available = slots.availableSlots.includes(heure);
    return reply.send({
      success: true,
      available,
      conflicts: available ? 0 : 1,
    });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function getAvailableSlots(request, reply) {
  try {
    const date = toYmd(request.query.date);
    const slots = await getOrderSlots(tenantIdOf(request), date);
    return reply.send({
      success: true,
      availableSlots: slots.availableSlots,
      occupiedSlots: slots.occupiedSlots,
      message: slots.message,
    });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function createOrderFromAI(request, reply) {
  try {
    const orderData = request.body || {};
    if (orderData.type === "Réservation de table") {
      return reply.code(400).send({
        error: "Pour une réservation, utiliser l'endpoint /api/reservations/ai/create.",
      });
    }
    const rawPhone = String(orderData.clientPhone ?? orderData.telephone ?? "").trim();
    assertPhone(rawPhone);
    const heureNormalized = normalizeHhmm(orderData.time ?? orderData.heure);
    if (!heureNormalized) throw new BusinessRuleError("Heure invalide ou manquante.");
    const orderDate = toYmd(orderData.date);
    if (!orderDate) throw new BusinessRuleError("Date invalide ou manquante.");
    const existing = await OrderService.findRecentOrder({
      instanceId: tenantIdOf(request),
      telephone: rawPhone,
      date: orderDate,
      heure: heureNormalized,
    });
    if (existing) {
      return reply.code(200).send({
        success: true,
        data: existing,
        message: "Commande déjà créée",
      });
    }
    const order = await OrderService.createOrder(tenantIdOf(request), {
      nom: (orderData.name || "Client").trim(),
      telephone: rawPhone,
      date: orderDate,
      heure: heureNormalized,
      commandes: orderData.commandes || [],
      statut: "confirme",
      createdBy: "system",
    });
    return reply.code(201).send({ success: true, data: order });
  } catch (error) {
    return sendError(reply, error);
  }
}

export { digitsOnly };
