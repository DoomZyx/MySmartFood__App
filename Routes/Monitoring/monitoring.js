import { requireAdmin } from "../../middleware/auth.js";
import { MonitoringController } from "../../API/controllers/MonitoringController.js";

export default async function monitoringRoutes(fastify) {
  fastify.get("/", {
    preHandler: [requireAdmin],
    handler: MonitoringController.getSnapshot,
  });

  fastify.get("/metrics", {
    preHandler: [requireAdmin],
    handler: MonitoringController.getMetrics,
  });

  fastify.get("/alerts", {
    preHandler: [requireAdmin],
    schema: {
      querystring: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
      },
    },
    handler: MonitoringController.getAlerts,
  });
}
