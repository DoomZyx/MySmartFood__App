import { requireAuth } from "../../middleware/sessionAuth.js";
import {
  requireActiveSubscription,
  requireRestaurantDashboard,
  resolveTenant,
} from "../../middleware/tenantContext.js";
import { LlmUsageController } from "../../API/controllers/LlmUsageController.js";

export default async function usageRoutes(fastify) {
  fastify.get(
    "/",
    {
      preHandler: [requireAuth, resolveTenant, requireActiveSubscription, requireRestaurantDashboard],
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
      },
    },
    LlmUsageController.listForRestaurant
  );
}
