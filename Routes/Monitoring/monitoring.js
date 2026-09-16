import { requireAuth } from "../../middleware/sessionAuth.js";
import { requireActiveSubscription, resolveTenant } from "../../middleware/tenantContext.js";
import { MonitoringController } from "../../API/controllers/MonitoringController.js";

async function requireMonitoringAccess(request, reply) {
  await requireAuth(request, reply);
  if (reply.sent) return;
  if (request.user.isPlatformAdmin) return;
  await resolveTenant(request, reply);
  if (reply.sent) return;
  await requireActiveSubscription(request, reply);
}

export default async function monitoringRoutes(fastify) {
  fastify.get("/", {
    preHandler: [requireMonitoringAccess],
    handler: MonitoringController.getSnapshot,
  });

  fastify.get("/metrics", {
    preHandler: [requireMonitoringAccess],
    handler: MonitoringController.getMetrics,
  });

  fastify.get("/alerts", {
    preHandler: [requireMonitoringAccess],
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
