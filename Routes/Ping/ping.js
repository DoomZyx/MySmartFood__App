import logger from "#logger";
import {
  getHealthPayload,
  getPublicStatusPayload,
} from "../../Services/monitoring/monitoringService.js";

export default async function pingRoutes(fastify) {
  fastify.get("/ping", {
    handler: async (request, reply) => {
      return reply.code(200).send({
        success: true,
        message: "Backend actif",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    },
  });

  fastify.get("/health", {
    handler: async (request, reply) => {
      try {
        const { ok, body } = await getHealthPayload();
        return reply.code(ok ? 200 : 503).send(body);
      } catch (err) {
        logger.error({ err: err.message }, "Health check: erreur inattendue");
        return reply.code(503).send({
          status: "degraded",
          service: "RestaurantApp Backend",
          db: "error",
          timestamp: new Date().toISOString(),
        });
      }
    },
  });

  fastify.get("/status", {
    handler: async (request, reply) => {
      const payload = await getPublicStatusPayload();
      return reply.code(200).send(payload);
    },
  });
}
