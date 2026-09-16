import { LlmUsageService } from "../../Business/services/LlmUsageService.js";
import logger from "../../Services/logging/logger.js";

export class LlmUsageController {
  static async recordFromVoice(request, reply) {
    try {
      const body = request.body || {};
      await LlmUsageService.record(body.instanceId, {
        source: body.source || "voice",
        provider: body.provider,
        model: body.model,
        inputTokens: body.inputTokens,
        outputTokens: body.outputTokens,
        totalTokens: body.totalTokens,
        latencyMs: body.latencyMs,
      });
      return reply.code(204).send();
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur enregistrement usage LLM");
      return reply.code(400).send({
        success: false,
        error: "Usage LLM invalide",
      });
    }
  }

  static async listForRestaurant(request, reply) {
    try {
      const tenantId = request.tenant?.id;
      const limit = request.query?.limit;
      const data = await LlmUsageService.listForTenant(tenantId, limit);
      return reply.send({ success: true, data });
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur lecture usage LLM");
      return reply.code(500).send({
        success: false,
        error: "Impossible de recuperer l'usage LLM",
      });
    }
  }
}
