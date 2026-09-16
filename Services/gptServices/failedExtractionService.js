import { withTenant } from "../../database/transaction.js";
import * as FailedExtraction from "../../models/pg/FailedExtraction.js";
import { callLogger } from "../logging/logger.js";
import { resolveRuntimeTenantId } from "../../utils/runtimeTenant.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tenantIdOrNull(instanceId) {
  const id = resolveRuntimeTenantId(instanceId);
  return UUID_PATTERN.test(id) ? id : null;
}

export class FailedExtractionService {
  static async saveFailedExtraction(streamSid, transcription, error, tentatives = 0, instanceId = null) {
    const tenantId = tenantIdOrNull(instanceId);
    if (!tenantId) {
      callLogger.warn(streamSid, "Extraction échouée non persistée : tenant manquant", {
        event: "failed_extraction_skipped",
      });
      return null;
    }
    try {
      const saved = await withTenant(tenantId, (client) =>
        FailedExtraction.create(client, tenantId, {
          streamSid,
          transcript: transcription,
          errorMessage: error?.message || "Erreur inconnue",
          errorStack: error?.stack || null,
          attempts: tentatives,
          status: "extraction_echouee",
          legacyPayload: {
            status: error?.status || (error?.response && error.response.status) || null,
            code: error?.code || null,
          },
        })
      );

      callLogger.info(streamSid, "Transcription brute sauvegardée pour traitement manuel", {
        failedExtractionId: saved.id,
        error: error?.message,
        tentatives,
        event: "failed_extraction_saved",
      });

      return saved;
    } catch (saveError) {
      callLogger.error(streamSid, saveError, {
        source: "FailedExtractionService",
        context: "save_failed_extraction",
        originalError: error?.message,
      });
      return null;
    }
  }

  static async getPendingExtractions(options = {}) {
    const tenantId = tenantIdOrNull(options.instanceId);
    if (!tenantId) return [];
    const { limit = 50, skip = 0 } = options;
    return withTenant(tenantId, (client) =>
      FailedExtraction.listPending(client, tenantId, { limit, offset: skip })
    );
  }

  static async markAsProcessed(id, instanceId = null) {
    const tenantId = tenantIdOrNull(instanceId);
    if (!tenantId) return null;
    return withTenant(tenantId, (client) => FailedExtraction.markProcessed(client, tenantId, id));
  }

  static async countSince(since, instanceId = null) {
    const tenantId = tenantIdOrNull(instanceId);
    if (!tenantId) return null;
    return withTenant(tenantId, (client) => FailedExtraction.countSince(client, tenantId, since));
  }
}
