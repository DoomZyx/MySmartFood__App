import {
  createPlatformStaff,
  listPlatformStaff,
  revokePlatformStaff,
} from "../../Business/services/PlatformStaffService.js";
import logger from "../../Services/logging/logger.js";

function handleError(error, reply) {
  const status = error.statusCode || 500;
  if (status >= 500) {
    logger.error({ err: error.message }, "Comptes back-office");
  }
  return reply.code(status).send({ error: error.message || "Erreur serveur" });
}

export const PlatformStaffController = {
  async list(_request, reply) {
    try {
      const staff = await listPlatformStaff();
      return reply.send({ staff });
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async create(request, reply) {
    try {
      const staff = await createPlatformStaff(request.body || {});
      return reply.code(201).send({ staff });
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async revoke(request, reply) {
    try {
      const staff = await revokePlatformStaff(request.user.id, request.params.userId);
      return reply.send({ staff });
    } catch (error) {
      return handleError(error, reply);
    }
  },
};
