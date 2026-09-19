import {
  deletePlatformUser,
  getPlatformUser,
  listPlatformUsers,
  updatePlatformUser,
} from "../../Business/services/PlatformUsersService.js";
import logger from "../../Services/logging/logger.js";

function handleError(error, reply) {
  const status = error.statusCode || 500;
  if (status >= 500) {
    logger.error({ err: error.message }, "Utilisateurs plateforme");
  }
  return reply.code(status).send({ error: error.message || "Erreur serveur" });
}

export const PlatformUsersController = {
  async list(request, reply) {
    try {
      const result = await listPlatformUsers({
        search: request.query?.search,
        limit: request.query?.limit,
        offset: request.query?.offset,
      });
      return reply.send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async get(request, reply) {
    try {
      const user = await getPlatformUser(request.params.userId);
      return reply.send({ user });
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async update(request, reply) {
    try {
      const user = await updatePlatformUser(request.user, request.params.userId, request.body || {});
      return reply.send({ user });
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async remove(request, reply) {
    try {
      const result = await deletePlatformUser(request.user, request.params.userId);
      return reply.send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  },
};
