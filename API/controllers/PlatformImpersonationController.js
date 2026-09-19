import {
  startImpersonation,
  stopImpersonation,
} from "../../Business/services/PlatformImpersonationService.js";
import logger from "../../Services/logging/logger.js";

function handleError(error, reply) {
  const status = error.statusCode || 500;
  if (status >= 500) {
    logger.error({ err: error.message }, "Impersonation plateforme");
  }
  return reply.code(status).send({ error: error.message || "Erreur serveur" });
}

export const PlatformImpersonationController = {
  async start(request, reply) {
    try {
      const result = await startImpersonation(reply, request.user, request.body || {});
      return reply.send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async stop(request, reply) {
    try {
      await stopImpersonation(reply, request.user, request);
      return reply.code(204).send();
    } catch (error) {
      return handleError(error, reply);
    }
  },
};
