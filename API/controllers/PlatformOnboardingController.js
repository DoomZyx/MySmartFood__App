import {
  activateTenant,
  assignInboundNumber,
  closeTenant,
  createPlatformTenant,
  getInbox,
  updatePlatformTenant,
  getTenant,
  listTenants,
  loadTenantDocumentFile,
  rejectTenant,
  suspendTenant,
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
        queue: request.query?.queue,
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

  async documentFile(request, reply) {
    try {
      const file = await loadTenantDocumentFile(
        request.params.tenantId,
        request.params.kind
      );
      return reply
        .header("Cache-Control", "private, no-store")
        .header("Content-Disposition", `inline; filename="${file.filename}"`)
        .type(file.mimeType)
        .send(file.buffer);
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async create(request, reply) {
    try {
      const result = await createPlatformTenant(request.body);
      return reply.code(201).send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async update(request, reply) {
    try {
      const result = await updatePlatformTenant(request.params.tenantId, request.body);
      return reply.send(result);
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

  async reject(request, reply) {
    try {
      const tenant = await rejectTenant(
        request.params.tenantId,
        request.body?.reason
      );
      return reply.send({ tenant });
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async suspend(request, reply) {
    try {
      const tenant = await suspendTenant(request.params.tenantId);
      return reply.send({ tenant });
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async close(request, reply) {
    try {
      const tenant = await closeTenant(request.params.tenantId);
      return reply.send({ tenant });
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async inbox(request, reply) {
    try {
      const inbox = await getInbox();
      return reply.send({ success: true, data: inbox });
    } catch (error) {
      return handleError(error, reply);
    }
  },
};
