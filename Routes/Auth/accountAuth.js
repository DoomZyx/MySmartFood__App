import { AccountAuthController } from "../../API/controllers/AccountAuthController.js";
import { TenantUserController } from "../../API/controllers/TenantUserController.js";
import { requireAuth } from "../../middleware/sessionAuth.js";
import { requireTenantStaffAdmin } from "../../middleware/tenantAccess.js";

export default async function accountAuthRoutes(fastify) {
  const authLimit = {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
      },
    },
  };

  fastify.post("/register", {
    ...authLimit,
    schema: {
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8 },
          name: { type: "string" },
        },
      },
    },
    handler: AccountAuthController.register,
  });

  fastify.post("/login", {
    ...authLimit,
    schema: {
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
      },
    },
    handler: AccountAuthController.login,
  });

  fastify.get("/me", {
    preHandler: [requireAuth],
    handler: AccountAuthController.me,
  });

  fastify.post("/logout", {
    handler: AccountAuthController.logout,
  });

  fastify.post("/redeem-access", {
    ...authLimit,
    schema: {
      body: {
        type: "object",
        required: ["token"],
        properties: {
          token: { type: "string", minLength: 32 },
        },
      },
    },
    handler: AccountAuthController.redeemAccess,
  });

  fastify.post("/resend-access", {
    ...authLimit,
    preHandler: [requireAuth],
    handler: AccountAuthController.resendAccess,
  });

  fastify.post("/google/confirm-link", {
    ...authLimit,
    handler: AccountAuthController.confirmGoogleLink,
  });

  fastify.post("/set-password", {
    preHandler: [requireAuth],
    handler: AccountAuthController.setPassword,
  });

  fastify.get("/profile", {
    preHandler: [requireAuth],
    handler: AccountAuthController.getWebsiteProfile,
  });

  fastify.put("/profile", {
    preHandler: [requireAuth],
    handler: AccountAuthController.updateWebsiteProfile,
  });

  fastify.post("/profile/submit-onboarding", {
    preHandler: [requireAuth],
    handler: AccountAuthController.submitWebsiteOnboarding,
  });

  fastify.get("/account", {
    preHandler: [requireAuth],
    handler: AccountAuthController.getAccount,
  });

  fastify.put("/account", {
    preHandler: [requireAuth],
    schema: {
      body: {
        type: "object",
        properties: {
          username: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          telephone: { type: "string" },
          poste: { type: "string" },
          departement: { type: "string" },
          avatar: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    handler: AccountAuthController.updateAccount,
  });

  fastify.post("/account/avatar", {
    preHandler: [requireAuth],
    handler: AccountAuthController.uploadAccountAvatar,
  });

  const staffAdmin = { preHandler: [requireTenantStaffAdmin] };

  fastify.get("/users", {
    ...staffAdmin,
    handler: TenantUserController.list,
  });

  fastify.post("/users", {
    ...staffAdmin,
    schema: {
      body: {
        type: "object",
        required: ["email", "username"],
        properties: {
          username: { type: "string" },
          email: { type: "string", format: "email" },
          password: { type: "string" },
          role: { type: "string", enum: ["admin", "user"] },
        },
      },
    },
    handler: TenantUserController.create,
  });

  fastify.put("/users/:id", {
    ...staffAdmin,
    schema: {
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
    },
    handler: TenantUserController.update,
  });

  fastify.delete("/users/:id", {
    ...staffAdmin,
    schema: {
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
    },
    handler: TenantUserController.remove,
  });
}
