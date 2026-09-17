import { PlatformOnboardingController } from "../../API/controllers/PlatformOnboardingController.js";
import { PlatformStaffController } from "../../API/controllers/PlatformStaffController.js";
import { requirePlatformAdmin, requirePlatformOwner } from "../../middleware/sessionAuth.js";
import { MAX_SOURCE_UPLOAD_BYTES } from "../../utils/imageWebp.js";

const TENANT_ID = {
  type: "string",
  format: "uuid",
};

const TENANT_BODY_PROPERTIES = {
  email: { type: "string", format: "email", maxLength: 255 },
  password: { type: "string", minLength: 8, maxLength: 128 },
  name: { type: "string", minLength: 1, maxLength: 200 },
  ownerName: { type: "string", maxLength: 120 },
  countryCode: { type: "string", enum: ["FR", "BE", "LU"] },
  country: { type: "string", maxLength: 100 },
  addressLine: { type: "string", maxLength: 300 },
  postalCode: { type: "string", maxLength: 20 },
  city: { type: "string", maxLength: 100 },
  restaurantPhone: { type: "string", maxLength: 30 },
  restaurantEmail: { type: "string", format: "email", maxLength: 255 },
  seatCount: { type: "integer", minimum: 1, maximum: 999 },
  cuisineType: { type: "string", maxLength: 100 },
  phoneNumberUsage: { type: "string", maxLength: 2000 },
  siret: { type: "string", maxLength: 20 },
  siren: { type: "string", maxLength: 20 },
  companyNumber: { type: "string", maxLength: 20 },
  phoneNumber: { type: "string", maxLength: 20 },
  phoneNumberSid: { type: "string", maxLength: 40 },
  openaiApiKey: { type: "string", maxLength: 256 },
  openaiModel: { type: "string", maxLength: 80 },
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

  fastify.get("/tenants/:tenantId/documents/:kind", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    schema: {
      params: {
        type: "object",
        required: ["tenantId", "kind"],
        properties: {
          tenantId: TENANT_ID,
          kind: { type: "string", enum: ["kbis", "id_recto", "id_verso", "address_proof"] },
        },
      },
    },
    handler: PlatformOnboardingController.documentFile,
  });

  fastify.post("/tenants/:tenantId/documents", {
    onRequest: csrf,
    bodyLimit: MAX_SOURCE_UPLOAD_BYTES + 1024 * 1024,
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: {
      params: {
        type: "object",
        required: ["tenantId"],
        properties: { tenantId: TENANT_ID },
      },
    },
    handler: PlatformOnboardingController.uploadDocument,
  });

  fastify.post("/tenants", {
    onRequest: csrf,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: {
      body: {
        type: "object",
        required: ["email", "password", "name"],
        properties: TENANT_BODY_PROPERTIES,
      },
    },
    handler: PlatformOnboardingController.create,
  });

  fastify.patch("/tenants/:tenantId", {
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
        properties: TENANT_BODY_PROPERTIES,
      },
    },
    handler: PlatformOnboardingController.update,
  });

  fastify.get("/tenants/:tenantId/users", {
    schema: {
      params: {
        type: "object",
        required: ["tenantId"],
        properties: { tenantId: TENANT_ID },
      },
    },
    handler: PlatformOnboardingController.listUsers,
  });

  fastify.patch("/tenants/:tenantId/users/:userId", {
    onRequest: csrf,
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: {
      params: {
        type: "object",
        required: ["tenantId", "userId"],
        properties: {
          tenantId: TENANT_ID,
          userId: { type: "string", format: "uuid" },
        },
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string", maxLength: 120 },
          email: { type: "string", format: "email", maxLength: 255 },
          password: { type: "string", maxLength: 128 },
        },
      },
    },
    handler: PlatformOnboardingController.updateUser,
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

  const ownerOnly = [requirePlatformOwner];

  fastify.get("/staff", {
    preHandler: ownerOnly,
    handler: PlatformStaffController.list,
  });

  fastify.post("/staff", {
    onRequest: csrf,
    preHandler: ownerOnly,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: {
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", maxLength: 255 },
          password: { type: "string", minLength: 8, maxLength: 128 },
          name: { type: "string", maxLength: 120 },
        },
      },
    },
    handler: PlatformStaffController.create,
  });

  fastify.patch("/staff/:userId", {
    onRequest: csrf,
    preHandler: ownerOnly,
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: {
      params: {
        type: "object",
        required: ["userId"],
        properties: { userId: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string", maxLength: 120 },
          email: { type: "string", format: "email", maxLength: 255 },
          password: { type: "string", maxLength: 128 },
        },
      },
    },
    handler: PlatformStaffController.update,
  });

  fastify.post("/staff/:userId/revoke", {
    onRequest: csrf,
    preHandler: ownerOnly,
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: {
      params: {
        type: "object",
        required: ["userId"],
        properties: { userId: { type: "string", format: "uuid" } },
      },
    },
    handler: PlatformStaffController.revoke,
  });
}
