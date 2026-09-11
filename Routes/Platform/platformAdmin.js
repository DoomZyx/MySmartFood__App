import { PlatformOnboardingController } from "../../API/controllers/PlatformOnboardingController.js";
import { requirePlatformAdmin } from "../../middleware/sessionAuth.js";

const TENANT_ID = {
  type: "string",
  format: "uuid",
};

export default async function platformAdminRoutes(fastify) {
  fastify.addHook("preHandler", requirePlatformAdmin);

  fastify.get("/tenants", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          status: { type: "string" },
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
    schema: {
      params: {
        type: "object",
        required: ["tenantId"],
        properties: { tenantId: TENANT_ID },
      },
    },
    handler: PlatformOnboardingController.activate,
  });
}
