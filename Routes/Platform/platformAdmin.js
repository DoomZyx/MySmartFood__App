import { PlatformOnboardingController } from "../../API/controllers/PlatformOnboardingController.js";
import { PlatformStaffController } from "../../API/controllers/PlatformStaffController.js";
import { PlatformUsersController } from "../../API/controllers/PlatformUsersController.js";
import { PlatformTenantOpsController } from "../../API/controllers/PlatformTenantOpsController.js";
import { PlatformImpersonationController } from "../../API/controllers/PlatformImpersonationController.js";
import {
  requirePlatformAdmin,
  requirePlatformRouteCapability,
} from "../../middleware/sessionAuth.js";
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
  internalNote: { type: "string", maxLength: 2000 },
};

export default async function platformAdminRoutes(fastify) {
  fastify.addHook("preHandler", requirePlatformAdmin);
  fastify.addHook("preHandler", requirePlatformRouteCapability);
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
          queue: { type: "string", enum: ["pending", "fleet", "closed"] },
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
      querystring: {
        type: "object",
        properties: {
          includeClosed: { type: "boolean" },
        },
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

  fastify.post("/tenants/:tenantId/users", {
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
        required: ["email"],
        properties: {
          email: { type: "string", format: "email", maxLength: 255 },
          name: { type: "string", maxLength: 120 },
          password: { type: "string", minLength: 8, maxLength: 128 },
          role: { type: "string", enum: ["admin", "member", "user"] },
        },
      },
    },
    handler: PlatformOnboardingController.addUser,
  });

  fastify.delete("/tenants/:tenantId/users/:userId", {
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
    },
    handler: PlatformOnboardingController.removeUser,
  });

  fastify.patch("/leads/:kind/:leadId", {
    onRequest: csrf,
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: {
      params: {
        type: "object",
        required: ["kind", "leadId"],
        properties: {
          kind: { type: "string", enum: ["contact", "demo"] },
          leadId: { type: "string", format: "uuid" },
        },
      },
      body: {
        type: "object",
        properties: {
          internalNote: { type: "string", maxLength: 2000 },
        },
      },
    },
    handler: PlatformOnboardingController.updateLeadNote,
  });

  fastify.post("/leads/:kind/:leadId/convert", {
    onRequest: csrf,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: {
      params: {
        type: "object",
        required: ["kind", "leadId"],
        properties: {
          kind: { type: "string", enum: ["contact", "demo"] },
          leadId: { type: "string", format: "uuid" },
        },
      },
    },
    handler: PlatformOnboardingController.convertLead,
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

  fastify.get("/tenants/:tenantId/ops", {
    schema: {
      params: {
        type: "object",
        required: ["tenantId"],
        properties: { tenantId: TENANT_ID },
      },
    },
    handler: PlatformTenantOpsController.get,
  });

  fastify.patch("/tenants/:tenantId/hours", {
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
        required: ["horairesOuverture"],
        properties: {
          horairesOuverture: { type: "object" },
        },
      },
    },
    handler: PlatformTenantOpsController.updateHours,
  });

  fastify.patch("/tenants/:tenantId/menu-items/:itemId", {
    onRequest: csrf,
    config: { rateLimit: { max: 40, timeWindow: "1 minute" } },
    schema: {
      params: {
        type: "object",
        required: ["tenantId", "itemId"],
        properties: {
          tenantId: TENANT_ID,
          itemId: { type: "string", format: "uuid" },
        },
      },
      body: {
        type: "object",
        properties: {
          name: { type: "string", maxLength: 200 },
          prixBase: { type: "number", minimum: 0, maximum: 100000 },
          disponible: { type: "boolean" },
        },
      },
    },
    handler: PlatformTenantOpsController.updateMenuItem,
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
          role: { type: "string", enum: ["admin", "member", "user"] },
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

  fastify.get("/users", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          search: { type: "string", maxLength: 120 },
          limit: { type: "integer", minimum: 1, maximum: 500 },
          offset: { type: "integer", minimum: 0, maximum: 10000 },
        },
      },
    },
    handler: PlatformUsersController.list,
  });

  fastify.get("/users/:userId", {
    schema: {
      params: {
        type: "object",
        required: ["userId"],
        properties: { userId: { type: "string", format: "uuid" } },
      },
    },
    handler: PlatformUsersController.get,
  });

  fastify.patch("/users/:userId", {
    onRequest: csrf,
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
          emailVerified: { type: "boolean" },
          unlockDashboard: { type: "boolean" },
        },
      },
    },
    handler: PlatformUsersController.update,
  });

  fastify.delete("/users/:userId", {
    onRequest: csrf,
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: {
      params: {
        type: "object",
        required: ["userId"],
        properties: { userId: { type: "string", format: "uuid" } },
      },
    },
    handler: PlatformUsersController.remove,
  });

  fastify.post("/impersonate", {
    onRequest: csrf,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: {
      body: {
        type: "object",
        required: ["userId"],
        properties: {
          userId: { type: "string", format: "uuid" },
          tenantId: { type: "string", format: "uuid" },
        },
      },
    },
    handler: PlatformImpersonationController.start,
  });

  fastify.post("/impersonate/stop", {
    onRequest: csrf,
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    handler: PlatformImpersonationController.stop,
  });

  fastify.get("/staff", {
    handler: PlatformStaffController.list,
  });

  fastify.post("/staff", {
    onRequest: csrf,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: {
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", maxLength: 255 },
          password: { type: "string", minLength: 8, maxLength: 128 },
          name: { type: "string", maxLength: 120 },
          role: { type: "string", enum: ["ops", "support", "billing", "readonly"] },
        },
      },
    },
    handler: PlatformStaffController.create,
  });

  fastify.patch("/staff/:userId", {
    onRequest: csrf,
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
          role: { type: "string", enum: ["ops", "support", "billing", "readonly"] },
        },
      },
    },
    handler: PlatformStaffController.update,
  });

  fastify.post("/staff/:userId/revoke", {
    onRequest: csrf,
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
