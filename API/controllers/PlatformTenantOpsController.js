import {
  getTenantOps,
  updateTenantHours,
  updateTenantMenuItem,
} from "../../Business/services/PlatformTenantOpsService.js";
import logger from "../../Services/logging/logger.js";

function handleError(error, reply) {
  const status = error.statusCode || 500;
  if (status >= 500) {
    logger.error({ err: error.message }, "Données restaurant plateforme");
  }
  return reply.code(status).send({ error: error.message || "Erreur serveur" });
}

export const PlatformTenantOpsController = {
  async get(request, reply) {
    try {
      const ops = await getTenantOps(request.params.tenantId);
      return reply.send(ops);
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async updateHours(request, reply) {
    try {
      const ops = await updateTenantHours(
        request.params.tenantId,
        request.body?.horairesOuverture
      );
      return reply.send(ops);
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async updateMenuItem(request, reply) {
    try {
      const ops = await updateTenantMenuItem(
        request.params.tenantId,
        request.params.itemId,
        request.body || {}
      );
      return reply.send(ops);
    } catch (error) {
      return handleError(error, reply);
    }
  },
};
