import { CheckoutController, stripeWebhookHandler } from "../../API/controllers/CheckoutController.js";
import { requireAuth } from "../../middleware/sessionAuth.js";

export default async function checkoutRoutes(fastify) {
  fastify.get("/plans", CheckoutController.listPlans);
  fastify.get("/status", CheckoutController.status);

  fastify.post("/start-beta", {
    preHandler: [requireAuth],
    handler: CheckoutController.startBeta,
  });

  fastify.post("/create-session", {
    preHandler: [requireAuth],
    handler: CheckoutController.createSession,
  });

  fastify.post("/sync-session", {
    preHandler: [requireAuth],
    handler: CheckoutController.syncSession,
  });

  fastify.post("/portal", {
    preHandler: [requireAuth],
    handler: CheckoutController.portal,
  });
}

export async function stripeWebhookRoutes(fastify) {
  fastify.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    done(null, body);
  });

  fastify.post("/api/checkout/webhook", stripeWebhookHandler);
}
