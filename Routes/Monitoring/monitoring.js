import { requirePlatformAdmin } from "../../middleware/sessionAuth.js";
import { MonitoringController } from "../../API/controllers/MonitoringController.js";

export default async function monitoringRoutes(fastify) {
  fastify.get("/", {
    preHandler: [requirePlatformAdmin],
    handler: MonitoringController.getSnapshot,
  });

  fastify.get("/metrics", {
    preHandler: [requirePlatformAdmin],
    handler: MonitoringController.getMetrics,
  });

  fastify.get("/alerts", {
    preHandler: [requirePlatformAdmin],
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
