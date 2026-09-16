import { PlatformOnboardingController } from "../../API/controllers/PlatformOnboardingController.js";
import { requirePlatformAdmin } from "../../middleware/sessionAuth.js";

const TENANT_ID = {
  type: "string",
  format: "uuid",
};

export default async function platformAdminRoutes(fastify) {
  fastify.addHook("preHandler", requirePlatformAdmin);
  const csrf = fastify.csrfProtection ? [fastify.csrfProtection] : [];

  fastify.get("/inbox", {
    handler: PlatformOnboardingController.inbox,
  });

  fastify.get("/tenants", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          status: { type: "string" },
          queue: { type: "string", enum: ["pending", "fleet"] },
          limit: { type: "integer", minimum: 1, maximum: 200 },
        },
      },
    },
    handler: PlatformOnboardingController.list,
  });

  fastify.get("/tenants/:tenantId", {
    schema: {
      params: {
        type: "object",
        required: ["tenantId"],
        properties: { tenantId: TENANT_ID },
      },
    },
    handler: PlatformOnboardingController.get,
  });

  fastify.post("/tenants/:tenantId/assign-phone", {
    onRequest: csrf,
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: {
      params: {
        type: "object",
        required: ["tenantId"],
        properties: { tenantId: TENANT_ID },
      },
      body: {
        type: "object",
        properties: {
          phoneNumber: { type: "string", maxLength: 20 },
          phoneNumberSid: { type: "string", maxLength: 40 },
        },
      },
    },
    handler: PlatformOnboardingController.assignPhone,
  });

  fastify.post("/tenants/:tenantId/activate", {
    onRequest: csrf,
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: {
      params: {
        type: "object",
        required: ["tenantId"],
        properties: { tenantId: TENANT_ID },
      },
    },
    handler: PlatformOnboardingController.activate,
  });

  fastify.post("/tenants/:tenantId/suspend", {
    onRequest: csrf,
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: {
      params: {
        type: "object",
        required: ["tenantId"],
        properties: { tenantId: TENANT_ID },
      },
    },
    handler: PlatformOnboardingController.suspend,
  });

  fastify.post("/tenants/:tenantId/close", {
    onRequest: csrf,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: {
      params: {
        type: "object",
        required: ["tenantId"],
        properties: { tenantId: TENANT_ID },
      },
    },
    handler: PlatformOnboardingController.close,
  });

  fastify.post("/tenants/:tenantId/reject", {
    onRequest: csrf,
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: {
      params: {
        type: "object",
        required: ["tenantId"],
        properties: { tenantId: TENANT_ID },
      },
      body: {
        type: "object",
        properties: {
          reason: { type: "string", maxLength: 500 },
        },
      },
    },
    handler: PlatformOnboardingController.reject,
  });
}
