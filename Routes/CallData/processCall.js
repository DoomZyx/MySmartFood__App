import { extractCallData } from "../../Services/gptServices/extractCallData.js";
import { ProcessCallService } from "../../Business/services/ProcessCallService.js";
import notificationService from "../../Services/notificationService.js";
import { callLogger } from "../../Services/logging/logger.js";
import { notifDebugLog } from "../../Services/logging/notifDebugLog.js";
import { retryWithBackoff } from "../../Services/utils/retryWithBackoff.js";
import { resolveRuntimeTenantId } from "../../utils/runtimeTenant.js";

function logStep(streamSid, step, detail = "") {
  const msg = `[process-call] ${step}${detail ? " " + detail : ""}`;
  notifDebugLog(msg);
  callLogger.info(streamSid, "process-call: " + step, detail ? { detail } : {});
}

/**
 * Appel considéré "inutile" : pas de résa/commande et infos par défaut (client inconnu, type info/autre).
 */
function isUselessCall(extractedData) {
  const hasReservationOrOrder =
    (extractedData.reservation != null) || (extractedData.order != null);
  if (hasReservationOrOrder) return false;

  const defaultNom = extractedData.nom === "Client inconnu";
  const defaultPhone = extractedData.telephone === "Non fourni";
  const typeInfoOrOther =
    extractedData.type_demande === "Information menu" || extractedData.type_demande === "Autre";

  return defaultNom && defaultPhone && typeInfoOrOther;
}

export default async function processCallRoutes(fastify, options) {
  fastify.post("/process-call", async (request, reply) => {
    const startTime = Date.now();
    const streamSid = request.headers["x-stream-sid"] || "unknown";

    logStep(streamSid, "1. Requete recue", "body keys=" + (request.body ? Object.keys(request.body).join(",") : "vide"));

    try {
      const { transcription } = request.body;

      if (!transcription || typeof transcription !== "string") {
        logStep(streamSid, "ERREUR: transcription manquante ou invalide");
        callLogger.error(streamSid, new Error("Transcription manquante"), { context: "validation" });
        return reply.code(400).send({ error: "Transcription manquante" });
      }

      const transcriptionLen = transcription.trim().length;
      logStep(streamSid, "2. Transcription presente", "length=" + transcriptionLen);

      logStep(streamSid, "3. Appel extractCallData (GPT)");
      let extractedData;
      try {
        extractedData = await extractCallData(transcription, streamSid);
        notifDebugLog("process-call: extractCallData ok nom=" + (extractedData?.nom ?? "?") + " type_demande=" + (extractedData?.type_demande ?? "?"));
      } catch (extractError) {
        logStep(streamSid, "ERREUR: extractCallData a echoue", extractError?.message || String(extractError));
        callLogger.error(streamSid, extractError, { context: "extractCallData" });
        throw extractError;
      }

      callLogger.extractionCompleted(streamSid, extractedData);

      const useless = isUselessCall(extractedData);
      logStep(streamSid, "4. Verif isUseless", "isUseless=" + useless + " hasResa=" + !!extractedData.reservation + " hasOrder=" + !!extractedData.order);

      if (useless) {
        logStep(streamSid, "5a. Branche ignoree -> envoi notif (ignored)");
        callLogger.info(streamSid, "Appel ignoré : Aucune information utile extraite", {
          nom: extractedData.nom,
          telephone: extractedData.telephone,
          type_demande: extractedData.type_demande,
        });
        try {
          notificationService.notifyCallEnded(extractedData, {});
        } catch (notifError) {
          callLogger.error(streamSid, notifError, { context: "notifyCallEnded_ignored" });
        }
        return reply.code(200).send({
          success: true,
          ignored: true,
          message: "Appel ignoré - Aucune information utile",
          reason: "Pas de nom, pas de téléphone, pas de réservation ni commande",
        });
      }

      logStep(streamSid, "5b. Branche traitement -> ProcessCallService.process");
      const saveStartTime = Date.now();
      callLogger.apiCallStarted(streamSid, "ProcessCallService.process");

      const instanceId = resolveRuntimeTenantId(request.instanceId);
      let result;
      try {
        result = await retryWithBackoff(
          () => ProcessCallService.process(extractedData, { instanceId }),
          {
            maxRetries: 3,
            baseDelay: 1000,
            onRetry: (attempt, error, delay) => {
              notifDebugLog("process-call: retry " + attempt + "/3 apres erreur " + (error?.message || error));
              callLogger.warn(streamSid, "Tentative " + attempt + "/3 de sauvegarde après erreur", {
                error: error?.message,
                delay: delay + "ms",
              });
            },
            shouldRetry: (err) => {
              const msg = err?.message || String(err);
              const retryable = /timeout|ECONNRESET|ETIMEDOUT|429|500|502|503|504/.test(msg) || err?.status >= 500;
              notifDebugLog("process-call: shouldRetry " + retryable + " pour " + msg);
              return retryable;
            },
          }
        );
      } catch (processError) {
        logStep(streamSid, "ERREUR: ProcessCallService.process a echoue", processError?.message || String(processError));
        callLogger.error(streamSid, processError, { context: "ProcessCallService.process" });
        throw processError;
      }

      callLogger.performance(streamSid, "api_save", Date.now() - saveStartTime);
      callLogger.apiCallCompleted(streamSid, { status: 201 });
      callLogger.performance(streamSid, "total_processing", Date.now() - startTime);

      const orderId = result?.order?._id?.toString() ?? result?.reservation?._id?.toString() ?? null;
      const appointmentType = result?.reservation ? "reservation" : result?.order ? "order" : null;
      logStep(streamSid, "6. Succes -> envoi notif (processed)", "orderId=" + (orderId || "—"));

      try {
        notificationService.notifyCallEnded(extractedData, {
          orderId,
          appointmentType,
          createdReservation: result.reservation,
          createdOrder: result.order,
        });
      } catch (notifError) {
        callLogger.error(streamSid, notifError, { context: "notifyCallEnded_processed" });
      }

      logStep(streamSid, "7. Reponse 201 envoyee");
      return reply.code(201).send({
        success: true,
        message: "Appel traité : réservation et/ou commande créée(s)",
        data: { reservation: result.reservation, order: result.order },
      });
    } catch (error) {
      logStep(streamSid, "ERREUR GLOBALE", error?.message || String(error));
      callLogger.error(streamSid, error, {
        context: "process_call",
        totalDuration: Date.now() - startTime,
      });
      return reply.code(500).send({
        error: "Erreur lors du traitement de l'appel",
        details: error?.message ?? "Erreur inconnue",
      });
    }
  });
}
