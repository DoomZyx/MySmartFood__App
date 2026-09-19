import { PricingService } from "../../Business/services/PricingService.js";
import logger from "../../Services/logging/logger.js";

export class VoiceContextController {
  static async getContext(request, reply) {
    try {
      const pricingContext = await PricingService.getPricingForGPT(
        request.params.instanceId,
      );
      return reply.send({
        success: true,
        data: pricingContext,
      });
    } catch (error) {
      logger.error(
        {
          err: error?.message,
          instanceId: request.params.instanceId,
        },
        "Erreur contexte Voice Service",
      );
      return reply.code(404).send({
        success: false,
        error: "Configuration vocale introuvable",
      });
    }
  }

  /** Snapshot live (ouvert + produits) pour gate mid-call avant create_appointment. */
  static async getSnapshot(request, reply) {
    try {
      const snapshot = await PricingService.getVoiceSnapshot(
        request.params.instanceId,
      );
      return reply.send({
        success: true,
        data: snapshot,
      });
    } catch (error) {
      logger.error(
        {
          err: error?.message,
          instanceId: request.params.instanceId,
        },
        "Erreur snapshot Voice Service",
      );
      return reply.code(404).send({
        success: false,
        error: "Configuration vocale introuvable",
      });
    }
  }
}
