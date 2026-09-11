import { TenantUserService } from "../../Business/services/TenantUserService.js";
import { AccountAuthError } from "../../Business/services/AccountAuthService.js";
import { UserTransformer } from "../../Business/transformers/UserTransformer.js";
import logger from "../../Services/logging/logger.js";

function handleError(error, reply, fallback) {
  if (error instanceof AccountAuthError) {
    return reply.code(error.statusCode).send({ error: error.message, success: false });
  }
  logger.error({ err: error.message }, fallback);
  return reply.code(500).send({ error: fallback, success: false });
}

export const TenantUserController = {
  async list(request, reply) {
    try {
      const users = await TenantUserService.list(request.tenant.id);
      return reply.send(UserTransformer.usersListResponse(users));
    } catch (error) {
      return handleError(error, reply, "Erreur lors de la récupération des utilisateurs");
    }
  },

  async create(request, reply) {
    try {
      const user = await TenantUserService.create(request.tenant.id, request.body || {});
      return reply.code(201).send(UserTransformer.userUpdateResponse(user));
    } catch (error) {
      return handleError(error, reply, "Erreur lors de la création de l'utilisateur");
    }
  },

  async update(request, reply) {
    try {
      const user = await TenantUserService.update(
        request.tenant.id,
        request.params.id,
        request.body || {},
        request.user.id
      );
      return reply.send(UserTransformer.userUpdateResponse(user));
    } catch (error) {
      return handleError(error, reply, "Erreur lors de la mise à jour de l'utilisateur");
    }
  },

  async remove(request, reply) {
    try {
      await TenantUserService.remove(request.tenant.id, request.params.id, request.user.id);
      return reply.send(UserTransformer.userDeleteResponse());
    } catch (error) {
      return handleError(error, reply, "Erreur lors de la suppression de l'utilisateur");
    }
  },
};
