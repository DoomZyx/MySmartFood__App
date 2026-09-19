import { extractCallData } from "../../Services/gptServices/extractCallData.js";
import notificationService from "../../Services/notificationService.js";
import logger from "../../Services/logging/logger.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TYPE_LABEL = {
  reservation: "Réservation de table",
  order: "Commande à emporter",
};

/**
 * Fin d'appel GPU.
 * Creation = tool live pendant l'appel uniquement.
 * Ce service n'appelle jamais ProcessCallService.process (pas de 2e insert).
 * Hangup sans tool → notification "appel sans creation", 0 ligne en base.
 */
export class VoiceHangupService {
  static turnsToTranscription(turns) {
    if (!Array.isArray(turns) || turns.length === 0) return "";
    const lines = [];
    for (const turn of turns) {
      const role = turn?.role === "assistant" ? "Assistant" : "Client";
      const content = typeof turn?.content === "string" ? turn.content.trim() : "";
      if (!content) continue;
      lines.push(`${role}: ${content}`);
    }
    return lines.join("\n");
  }

  static liveCreateFromBody(liveCreate) {
    if (!liveCreate || typeof liveCreate !== "object") return null;
    const type = liveCreate.type === "reservation" || liveCreate.type === "order"
      ? liveCreate.type
      : null;
    const id = liveCreate.id != null && String(liveCreate.id).trim() !== ""
      ? String(liveCreate.id).trim()
      : null;
    if (!type && !id) return null;
    return { type, id };
  }

  static async complete(body, { instanceId, streamSid } = {}) {
    const tenantId = String(instanceId || "").trim();
    if (!UUID_PATTERN.test(tenantId)) {
      const error = new Error("Établissement manquant pour clôturer l'appel");
      error.statusCode = 400;
      throw error;
    }

    const liveCreate = VoiceHangupService.liveCreateFromBody(body?.liveCreate);
    const transcription = VoiceHangupService.turnsToTranscription(body?.turns);
    let extractedData = {
      nom: "Client",
      telephone: "Non fourni",
      type_demande: liveCreate?.type ? TYPE_LABEL[liveCreate.type] : "Autre",
      description: "",
    };

    if (transcription) {
      try {
        extractedData = await extractCallData(transcription, streamSid || "unknown", tenantId);
      } catch (error) {
        logger.error(
          { err: error?.message, instanceId: tenantId },
          "extractCallData hangup GPU",
        );
      }
    }

    if (liveCreate?.type && TYPE_LABEL[liveCreate.type]) {
      extractedData = {
        ...extractedData,
        type_demande: TYPE_LABEL[liveCreate.type],
      };
    }

    // Creation = tool live. Jamais ProcessCallService.process ici.
    await notificationService.notifyCallEnded(extractedData, {
      orderId: liveCreate?.id || null,
      appointmentType: liveCreate?.type || null,
      tenantId,
    });

    return {
      persisted: false,
      notified: true,
      liveCreate,
    };
  }
}
