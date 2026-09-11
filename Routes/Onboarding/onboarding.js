import { requireAuth } from "../../middleware/sessionAuth.js";
import { requireRole, resolveTenant } from "../../middleware/tenantContext.js";
import {
  saveProfile,
  submitOnboardingDossier,
} from "../../Business/services/DocumentComplianceService.js";
import * as EstablishmentProfile from "../../models/pg/EstablishmentProfile.js";
import { findByTenantId as findJob } from "../../models/pg/ProvisioningJob.js";

function collectFiles(request) {
  const files = {};
  if (!request.files) return files;
  return files;
}

export default async function onboardingRoutes(fastify) {
  const guards = [requireAuth, resolveTenant, requireRole("owner", "admin")];

  fastify.get("/profile", {
    preHandler: guards,
    handler: async (request) => {
      const profile = await EstablishmentProfile.findByTenantId(request.tenant.id);
      const job = await findJob(request.tenant.id);
      return { profile: profile || {}, provisioning: job };
    },
  });

  fastify.put("/profile", {
    preHandler: guards,
    onRequest: fastify.csrfProtection ? [fastify.csrfProtection] : [],
    handler: async (request, reply) => {
      try {
        const profile = await saveProfile(request.tenant.id, request.body || {});
        return { profile };
      } catch (err) {
        return reply.code(err.statusCode || 500).send({ error: err.message });
      }
    },
  });

  fastify.post("/submit-dossier", {
    preHandler: guards,
    handler: async (request, reply) => {
      try {
        const files = {};
        const parts = request.parts();
        const body = {};
        for await (const part of parts) {
          if (part.file) {
            const chunks = [];
            for await (const chunk of part.file) chunks.push(chunk);
            files[part.fieldname] = {
              buffer: Buffer.concat(chunks),
              mimetype: part.mimetype,
              originalname: part.filename,
            };
          } else {
            body[part.fieldname] = part.value;
          }
        }
        void collectFiles;
        const result = await submitOnboardingDossier({
          tenantId: request.tenant.id,
          userId: request.user.id,
          body,
          files,
        });
        return reply.code(201).send(result);
      } catch (err) {
        return reply.code(err.statusCode || 500).send({ error: err.message });
      }
    },
  });
}
