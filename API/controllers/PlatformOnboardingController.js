import {
  activateTenant,
  addPlatformTenantMember,
  assignInboundNumber,
  closeTenant,
  convertLeadToTenant,
  createPlatformTenant,
  getInbox,
  updatePlatformTenant,
  getTenant,
  listPlatformTenantUsers,
  listTenants,
  removePlatformTenantMember,
  updateLeadNote,
  updatePlatformTenantUser,
  loadTenantDocumentFile,
  rejectTenant,
  suspendTenant,
  uploadPlatformTenantDocument,
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
      const includeClosed =
        request.query?.includeClosed === true ||
        request.query?.includeClosed === "true";
      const tenant = await getTenant(request.params.tenantId, { includeClosed });
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

  async uploadDocument(request, reply) {
    try {
      const parts = request.parts();
      let kind = request.body?.kind;
      let buffer = null;
      let mimeType = "";
      let filename = "";
      for await (const part of parts) {
        if (part.file) {
          const chunks = [];
          for await (const chunk of part.file) chunks.push(chunk);
          buffer = Buffer.concat(chunks);
          mimeType = part.mimetype;
          filename = part.filename || "";
          if (!kind && part.fields?.kind?.value) {
            kind = part.fields.kind.value;
          }
        } else if (part.fieldname === "kind") {
          kind = part.value;
        }
      }
      const result = await uploadPlatformTenantDocument(request.params.tenantId, {
        kind,
        buffer,
        mimeType,
        filename,
        userId: request.user.id,
      });
      return reply.send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async create(request, reply) {
    try {
      const result = await createPlatformTenant({
        ...request.body,
        actor: request.user,
      });
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

  async listUsers(request, reply) {
    try {
      const users = await listPlatformTenantUsers(request.params.tenantId);
      return reply.send({ users });
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async updateUser(request, reply) {
    try {
      const result = await updatePlatformTenantUser(
        request.params.tenantId,
        request.params.userId,
        request.body,
        request.user
      );
      return reply.send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async addUser(request, reply) {
    try {
      const result = await addPlatformTenantMember(
        request.params.tenantId,
        request.body,
        request.user
      );
      return reply.code(201).send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async removeUser(request, reply) {
    try {
      const result = await removePlatformTenantMember(
        request.params.tenantId,
        request.params.userId,
        request.user
      );
      return reply.send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async updateLeadNote(request, reply) {
    try {
      const result = await updateLeadNote(
        request.params.kind,
        request.params.leadId,
        request.body?.internalNote
      );
      return reply.send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async convertLead(request, reply) {
    try {
      const result = await convertLeadToTenant(
        request.params.kind,
        request.params.leadId,
        request.user
      );
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
      const tenant = await activateTenant(request.params.tenantId, request.user);
      return reply.send({ tenant });
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async reject(request, reply) {
    try {
      const tenant = await rejectTenant(
        request.params.tenantId,
        request.body?.reason,
        request.user
      );
      return reply.send({ tenant });
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async suspend(request, reply) {
    try {
      const tenant = await suspendTenant(request.params.tenantId, request.user);
      return reply.send({ tenant });
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async close(request, reply) {
    try {
      const tenant = await closeTenant(request.params.tenantId, request.user);
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
