import { OrderService } from "../Business/services/OrderService.js";
import * as Booking from "../Business/services/TenantBookingService.js";
import { getReservationSlots } from "../Business/services/AvailabilityService.js";
import { assertPhone, BusinessRuleError } from "../Business/validators/businessRules.js";
import { normalizeHhmm, toYmd } from "../utils/timeZone.js";
import logger from "../Services/logging/logger.js";

function tenantIdOf(request) {
  return request.tenant?.id || request.instanceId;
}

function sendError(reply, error) {
  const status = error.statusCode || (error.message?.includes("non trouv") ? 404 : 500);
  logger.error({ err: error?.message }, "Erreur réservation");
  return reply.code(status).send({
    error: status === 500 ? "Erreur interne du serveur" : error.message,
    details: error.message,
    remainingCovers: error.remainingCovers,
    requestedCovers: error.requestedCovers,
  });
}

export async function createReservation(request, reply) {
  try {
    const reservation = await Booking.createReservation(tenantIdOf(request), {
      ...request.body,
      createdBy: request.body.createdBy || "manual",
    });
    return reply.code(201).send({ success: true, data: reservation });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function getReservations(request, reply) {
  try {
    const page = Number(request.query.page) || 1;
    const limit = Number(request.query.limit) || 10;
    const result = await Booking.listReservations(tenantIdOf(request), {
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

export async function getTodayReservations(request, reply) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = await Booking.listReservations(tenantIdOf(request), {
      date: today,
      limit: 200,
    });
    return reply.send({ success: true, data: result.data });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function getReservationById(request, reply) {
  try {
    const reservation = await Booking.getReservation(tenantIdOf(request), request.params.id);
    return reply.send({ success: true, data: reservation });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function updateReservation(request, reply) {
  try {
    const reservation = await Booking.updateReservation(
      tenantIdOf(request),
      request.params.id,
      request.body
    );
    return reply.send({ success: true, data: reservation });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function updateReservationStatus(request, reply) {
  try {
    const reservation = await Booking.updateReservation(
      tenantIdOf(request),
      request.params.id,
      { statut: request.body.statut }
    );
    return reply.send({ success: true, data: reservation });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function deleteReservation(request, reply) {
  try {
    await Booking.deleteReservation(tenantIdOf(request), request.params.id);
    return reply.send({ success: true, message: "Réservation supprimée" });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function checkAvailability(request, reply) {
  try {
    const { date, heure } = request.query;
    const slots = await getReservationSlots(tenantIdOf(request), toYmd(date));
    return reply.send({
      success: true,
      available: slots.availableSlots.includes(heure),
      remainingCoversMidi: slots.remainingCoversMidi,
      remainingCoversSoir: slots.remainingCoversSoir,
    });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function getAvailableSlots(request, reply) {
  try {
    const slots = await getReservationSlots(tenantIdOf(request), toYmd(request.query.date));
    return reply.send({
      success: true,
      availableSlots: slots.availableSlots,
      occupiedSlots: slots.occupiedSlots,
      remainingCoversMidi: slots.remainingCoversMidi,
      remainingCoversSoir: slots.remainingCoversSoir,
      message: slots.message,
    });
  } catch (error) {
    return sendError(reply, error);
  }
}

export async function createReservationFromAI(request, reply) {
  try {
    const data = request.body || {};
    const rawPhone = String(data.telephone || "").trim();
    assertPhone(rawPhone);
    const heureNormalized = normalizeHhmm(data.time ?? data.heure);
    if (!heureNormalized) throw new BusinessRuleError("Heure invalide ou manquante.");
    const orderDate = toYmd(data.date);
    if (!orderDate) throw new BusinessRuleError("Date invalide ou manquante.");
    const existing = await OrderService.findRecentReservation({
      instanceId: tenantIdOf(request),
      telephone: rawPhone,
      date: orderDate,
      heure: heureNormalized,
    });
    if (existing) {
      return reply.code(200).send({
        success: true,
        data: existing,
        message: "Réservation déjà créée",
      });
    }
    const reservation = await OrderService.createReservation(tenantIdOf(request), {
      nom: data.name || data.nom || "Client",
      telephone: rawPhone,
      date: orderDate,
      heure: heureNormalized,
      description: data.description || "",
      nombrePersonnes: data.nombrePersonnes ?? 1,
      notes_internes: data.notes_internes || "",
      statut: "confirme",
      createdBy: "system",
    });
    return reply.code(201).send({ success: true, data: reservation });
  } catch (error) {
    return sendError(reply, error);
  }
}
