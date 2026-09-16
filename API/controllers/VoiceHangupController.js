import { VoiceHangupService } from "../../Business/services/VoiceHangupService.js";
import { resolveRuntimeTenantId } from "../../utils/runtimeTenant.js";
import logger from "../../Services/logging/logger.js";

export class VoiceHangupController {
  static async callEnded(request, reply) {
    try {
      const instanceId = resolveRuntimeTenantId(
        request.headers["x-tenant-id"] || request.body?.instanceId,
      );
      const streamSid =
        request.headers["x-stream-sid"] || request.body?.streamSid || "unknown";
      const result = await VoiceHangupService.complete(request.body || {}, {
        instanceId,
        streamSid,
      });
      return reply.code(200).send({
        success: true,
        persisted: result.persisted,
        notified: result.notified,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      logger.error({ err: error?.message }, "Erreur fin d'appel GPU");
      return reply.code(status).send({
        success: false,
        error:
          status === 400
            ? error.message
            : "Impossible de cloturer l'appel",
      });
    }
  }
}
