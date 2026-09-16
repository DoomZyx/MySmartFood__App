import { OrderService } from "./OrderService.js";
import { CallValidator } from "../validators/CallValidator.js";
import logger from "../../Services/logging/logger.js";

/**
 * Service de traitement des transcriptions d'appels (secteur restaurant).
 * Crée uniquement réservation et/ou commande à emporter, sans persister d'entité "appel".
 */
export class ProcessCallService {
  /**
   * Traite les données extraites d'une transcription : crée résa et/ou commande, envoie la notification.
   * @param {Object} extractedData - Données extraites par extractCallData (nom, telephone, reservation?, order?, ...)
   * @param {Object} [options] - { instanceId }
   * @returns {Promise<Object>} { reservation, order }
   */
  static async process(extractedData, options = {}) {
    const instanceId = options.instanceId;
    const {
      nom,
      telephone,
      reservation,
      order,
    } = extractedData;

    let createdReservation = null;
    let createdOrder = null;

    if (reservation && CallValidator.validateAppointment(reservation)) {
      try {
        createdReservation = await OrderService.createReservationFromData(reservation, {
          callId: null,
          instanceId,
        });
      } catch (err) {
        logger.error({ err: err?.message, instanceId }, "Erreur création réservation (processCall)");
        throw err;
      }
    }

    if (order && CallValidator.validateAppointment(order)) {
      try {
        createdOrder = await OrderService.createOrderFromAppointment(order, {
          client: null,
          callId: null,
          nom: nom || "Client inconnu",
          telephone: telephone && telephone !== "Non fourni" ? telephone : null,
          instanceId,
        });
      } catch (err) {
        logger.error({ err: err?.message, instanceId }, "Erreur création commande (processCall)");
        throw err;
      }
    }

    return { reservation: createdReservation, order: createdOrder };
  }
}
