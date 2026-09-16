import fetch from "node-fetch";
import dotenv from "dotenv";
import { resolveRuntimeTenantId } from "../../utils/runtimeTenant.js";

dotenv.config();

const LLM_SUCCESS_MESSAGE =
  "Enregistrement réussi. Confirme oralement en une phrase courte (nom et heure) puis clôture. Ne lis aucun identifiant.";

function minutesOfSlot(slot) {
  const [hours, minutes] = String(slot || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Compacte une liste HH:MM en fenêtres pour éviter que le LLM récite tous les créneaux. */
export function compactSlotWindows(slots, stepMinutes = 30) {
  const minutes = [...new Set((slots || []).map(minutesOfSlot).filter((value) => value != null))].sort(
    (a, b) => a - b,
  );
  if (minutes.length === 0) {
    return [];
  }
  const windows = [];
  let start = minutes[0];
  let previous = minutes[0];
  for (let index = 1; index < minutes.length; index += 1) {
    const current = minutes[index];
    if (current <= previous + stepMinutes) {
      previous = current;
      continue;
    }
    windows.push({ debut: formatMinutes(start), fin: formatMinutes(previous) });
    start = current;
    previous = current;
  }
  windows.push({ debut: formatMinutes(start), fin: formatMinutes(previous) });
  return windows;
}

export function summarizeAvailabilityForLlm({
  date,
  slots = [],
  message,
  remainingCoversMidi,
  remainingCoversSoir,
}) {
  const fenetres = compactSlotWindows(slots);
  const result = {
    success: true,
    date,
    closed: fenetres.length === 0,
    fenetres,
    instruction:
      "Ne lis pas les créneaux. Confirme seulement si l'heure demandée est dans une fenêtre. Sinon propose une seule alternative.",
  };
  if (message) {
    result.message = message;
  }
  if (remainingCoversMidi != null) {
    result.remainingCoversMidi = remainingCoversMidi;
  }
  if (remainingCoversSoir != null) {
    result.remainingCoversSoir = remainingCoversSoir;
  }
  return result;
}

function internalHeaders(instanceId) {
  return {
    "x-internal-secret":
      process.env.SMARTCRM_INTERNAL_SECRET ||
      process.env.WEBSITE_INTERNAL_SECRET ||
      process.env.X_API_KEY,
    "x-tenant-id": resolveRuntimeTenantId(instanceId),
  };
}

/**
 * Service de gestion des function calls OpenAI
 * Gère les appels aux APIs (disponibilités, création de rendez-vous, etc.)
 */
export class FunctionCallService {
  /**
   * Vérifie les disponibilités pour une date donnée
   * @param {string} date - Date au format YYYY-MM-DD
   * @returns {Promise<Object>} Résultat avec les créneaux disponibles
   */
  static async checkAvailability(date, instanceId) {
    try {
      const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
      const headers = internalHeaders(instanceId);

      const [ordersResponse, reservationsResponse] = await Promise.all([
        fetch(`${baseUrl}/api/orders/ai/available-slots?date=${date}`, { headers }),
        fetch(`${baseUrl}/api/reservations/ai/available-slots?date=${date}`, { headers }),
      ]);

      if (!ordersResponse.ok) {
        throw new Error(`HTTP ${ordersResponse.status}`);
      }

      const ordersData = await ordersResponse.json();
      const resaData = reservationsResponse.ok ? await reservationsResponse.json() : {};
      return summarizeAvailabilityForLlm({
        date,
        slots: ordersData.availableSlots || [],
        message: ordersData.message || "Disponibilités récupérées",
        remainingCoversMidi: resaData.remainingCoversMidi,
        remainingCoversSoir: resaData.remainingCoversSoir,
      });
    } catch (error) {
      return {
        success: false,
        error: `Impossible de vérifier les disponibilités: ${error.message}`,
      };
    }
  }

  /**
   * Crée un rendez-vous avec les informations fournies
   * @param {Object} args - Arguments du rendez-vous (date, time, name, etc.)
   * @returns {Promise<Object>} Résultat de la création
   */
  static async createAppointment(args, instanceId) {
    try {
      const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
      const isReservation = args.type === "Réservation de table";
      const url = isReservation
        ? `${baseUrl}/api/reservations/ai/create`
        : `${baseUrl}/api/orders/ai/create`;
      const requestBody = JSON.stringify(args);

      console.log("[FunctionCallService] Envoi requête createAppointment:", {
        url,
        type: args.type,
        body: requestBody,
        commandesCount: args.commandes ? args.commandes.length : 0,
        hasCommandes: Array.isArray(args.commandes) && args.commandes.length > 0,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...internalHeaders(instanceId),
        },
        body: requestBody,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = (errorData?.error || `HTTP ${response.status}`).toLowerCase();

        // Logger l'erreur HTTP
        console.error("[FunctionCallService] Erreur HTTP createAppointment:", {
          status: response.status,
          statusText: response.statusText,
          errorData: JSON.stringify(errorData, null, 2),
          requestBody: requestBody,
        });
        if (response.status === 400) {
          if (
            errorMessage.includes("téléphone") ||
            errorMessage.includes("phone") ||
            (errorMessage.includes("invalide") && errorMessage.includes("numéro"))
          ) {
            return {
              success: false,
              error: "NUMERO_MANQUANT",
              message: "Le numéro de téléphone n'a pas été fourni ou est invalide. Redemande poliment au client son numéro de téléphone, sans mentionner d'erreur technique.",
            };
          }
          if (errorMessage.includes("heure") || errorMessage.includes("time")) {
            return {
              success: false,
              error: "HEURE_INVALIDE",
              message: "L'heure n'a pas été fournie ou est invalide. Redemande poliment au client pour quelle heure il souhaite la commande, sans mentionner d'erreur technique.",
            };
          }
          if (errorMessage.includes("date")) {
            return {
              success: false,
              error: "DATE_INVALIDE",
              message: "La date n'a pas été fournie ou est invalide. Redemande poliment au client pour quelle date, sans mentionner d'erreur technique.",
            };
          }
          if (
            errorMessage.includes("capacité") ||
            errorMessage.includes("place") ||
            errorMessage.includes("couverts") ||
            (errorData?.remainingCovers != null && errorData?.requestedCovers != null)
          ) {
            const remaining = errorData?.remainingCovers;
            const msg =
              remaining != null
                ? `Il ne reste que ${remaining} place(s) pour ce service (midi ou soir). Propose poliment au client un autre créneau, un autre jour ou moins de convives, sans mentionner d'erreur technique.`
                : "Plus assez de places disponibles pour ce service. Propose poliment au client un autre créneau ou un autre jour.";
            return {
              success: false,
              error: "COUVERTS_INSUFFISANTS",
              message: msg,
            };
          }
          if (errorMessage.includes("invalide") || errorMessage.includes("manquant") || errorMessage.includes("validation")) {
            return {
              success: false,
              error: "DONNEES_INVALIDES",
              message: "Une information manque ou est invalide. Redemande poliment au client les informations manquantes (nom, numéro, heure, date), sans mentionner d'erreur technique.",
            };
          }
        }
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // Logger la réponse reçue
      console.log("[FunctionCallService] Réponse reçue createAppointment:", {
        status: response.status,
        statusText: response.statusText,
        responseData: JSON.stringify(data, null, 2),
        orderId: data?.data?._id || data?.data?.id || null,
        commandesCount: data?.data?.commandes ? data.data.commandes.length : 0,
      });

      return {
        success: true,
        created: true,
        message: data?.message || LLM_SUCCESS_MESSAGE,
      };
    } catch (error) {
      console.error("[FunctionCallService] Erreur createAppointment:", {
        error: error.message,
        stack: error.stack,
        args: JSON.stringify(args, null, 2),
      });
      return {
        success: false,
        error: `Impossible de créer le rendez-vous: ${error.message}`,
      };
    }
  }
}

