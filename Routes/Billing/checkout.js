import { createCheckoutSession, handleStripeWebhook } from "../../Business/services/StripeBillingService.js";
import { ensureBetaTenant } from "../../Business/services/TenantOnboardingService.js";
import { sessionPayload } from "../../Business/services/AccountAuthService.js";
import { requireAuth } from "../../middleware/sessionAuth.js";
import * as Plan from "../../models/pg/Plan.js";
import * as User from "../../models/pg/User.js";
import logger from "../../Services/logging/logger.js";

export default async function checkoutRoutes(fastify) {
  fastify.get("/plans", async () => {
    return { plans: await Plan.listActive() };
  });

  fastify.post("/start-beta", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      try {
        await ensureBetaTenant(request.user, {
          name: request.user.name || request.user.email,
        });
        const user = await User.findById(request.user.id);
        const payload = await sessionPayload(user);
        return reply.send(payload);
      } catch (err) {
        return reply.code(err.statusCode || 500).send({ error: err.message });
      }
    },
  });

  fastify.post("/create-session", {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      try {
        const result = await createCheckoutSession({
          user: request.user,
          planSlug: request.body?.planSlug,
          planId: request.body?.planId,
          countryCode: request.body?.countryCode,
        });
        return result;
      } catch (err) {
        return reply.code(err.statusCode || 500).send({ error: err.message });
      }
    },
  });
}

export async function stripeWebhookRoutes(fastify) {
  fastify.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    done(null, body);
  });

  fastify.post("/api/checkout/webhook", async (request, reply) => {
    try {
      const result = await handleStripeWebhook(
        request.body,
        request.headers["stripe-signature"]
      );
      return reply.send({ received: true, ...result });
    } catch (err) {
      logger.error({ err: err.message }, "Webhook Stripe");
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
}
