import { PricingService } from "../../Business/services/PricingService.js";
import { PricingTransformer } from "../../Business/transformers/PricingTransformer.js";
import logger from "../../Services/logging/logger.js";

/**
 * Controller de la ligne téléphonique (activation / désactivation)
 */
export class PhoneLineController {
  /**
   * Récupère l'état de la ligne téléphonique
   * GET /api/phone-line
   */
  static async getStatus(request, reply) {
    try {
      const instanceId = request.tenant?.id || request.instanceId;
      const enabled = await PricingService.getPhoneLineEnabled(instanceId);
      return reply.send(
        PricingTransformer.successResponse({ phoneLineEnabled: enabled })
      );
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur getPhoneLine");
      return reply.code(500).send(
        PricingTransformer.errorResponse("Erreur interne du serveur", error.message)
      );
    }
  }

  /**
   * Active ou désactive la ligne téléphonique
   * PATCH /api/phone-line
   */
  static async updateStatus(request, reply) {
    try {
      const body = request.body || {};
      const enabled = body.enabled;
      if (typeof enabled !== "boolean") {
        return reply.code(400).send(
          PricingTransformer.errorResponse("Le champ 'enabled' (boolean) est requis")
        );
      }
      const instanceId = request.tenant?.id || request.instanceId;
      await PricingService.updatePhoneLineEnabled(enabled, instanceId);
      return reply.send(
        PricingTransformer.successResponse(
          { phoneLineEnabled: !!enabled },
          "Ligne téléphonique mise à jour"
        )
      );
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur updatePhoneLine");
      return reply.code(500).send(
        PricingTransformer.errorResponse("Erreur interne du serveur", error.message)
      );
    }
  }
}
