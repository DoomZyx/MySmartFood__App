import { PlatformAdminAuthController } from "../../API/controllers/PlatformAdminAuthController.js";
import {
  requirePlatformAdmin,
  requirePlatformPending,
} from "../../middleware/sessionAuth.js";

const totpBody = {
  type: "object",
  required: ["token"],
  properties: {
    token: { type: "string", minLength: 6, maxLength: 12 },
  },
};

export default async function platformSessionRoutes(fastify) {
  const totpLimit = { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } };

  fastify.post("/login", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    schema: {
      body: {
        type: "object",
        required: ["email", "password", "accessCode"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 1 },
          accessCode: { type: "string", minLength: 8, maxLength: 128 },
        },
      },
    },
    handler: PlatformAdminAuthController.login,
  });

  fastify.get("/challenge", {
    preHandler: [(request, reply) => requirePlatformPending(request, reply)],
    handler: PlatformAdminAuthController.challenge,
  });

  fastify.get("/totp/setup", {
    ...totpLimit,
    preHandler: [(request, reply) => requirePlatformPending(request, reply, "enroll")],
    handler: PlatformAdminAuthController.totpSetup,
  });

  fastify.post("/totp/confirm", {
    ...totpLimit,
    preHandler: [(request, reply) => requirePlatformPending(request, reply, "enroll")],
    schema: { body: totpBody },
    handler: PlatformAdminAuthController.totpConfirm,
  });

  fastify.post("/totp/verify", {
    ...totpLimit,
    preHandler: [(request, reply) => requirePlatformPending(request, reply, "verify")],
    schema: { body: totpBody },
    handler: PlatformAdminAuthController.totpVerify,
  });

  fastify.get("/session", {
    preHandler: [requirePlatformAdmin],
    handler: PlatformAdminAuthController.session,
  });

  fastify.post("/logout", {
    preHandler: [requirePlatformAdmin],
    handler: PlatformAdminAuthController.logout,
  });
}
