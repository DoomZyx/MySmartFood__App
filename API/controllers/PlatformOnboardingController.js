import {
  activateTenant,
  assignInboundNumber,
  getTenant,
  listTenants,
} from "../../Business/services/PlatformOnboardingService.js";
import logger from "../../Services/logging/logger.js";

function handleError(error, reply) {
  const status = error.statusCode || 500;
  if (status >= 500) {
    logger.error({ err: error.message }, "Onboarding plateforme");
  }
  return reply.code(status).send({ error: error.message || "Erreur serveur" });
}

export const PlatformOnboardingController = {
  async list(request, reply) {
    try {
      const tenants = await listTenants({
        status: request.query?.status,
        limit: request.query?.limit,
      });
      return reply.send({ tenants });
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async get(request, reply) {
    try {
      const tenant = await getTenant(request.params.tenantId);
      return reply.send({ tenant });
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async assignPhone(request, reply) {
    try {
      const tenant = await assignInboundNumber(request.params.tenantId, {
        phoneNumber: request.body?.phoneNumber,
        phoneNumberSid: request.body?.phoneNumberSid,
      });
      return reply.send({ tenant });
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async activate(request, reply) {
    try {
      const tenant = await activateTenant(request.params.tenantId);
      return reply.send({ tenant });
    } catch (error) {
      return handleError(error, reply);
    }
  },
};
