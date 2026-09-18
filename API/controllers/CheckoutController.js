import * as Plan from "../../models/pg/Plan.js";
import * as User from "../../models/pg/User.js";
import { sessionPayload } from "../../Business/services/AccountAuthService.js";
import { ensureBetaTenant } from "../../Business/services/TenantOnboardingService.js";
import {
  billingStatus,
  createBillingPortalSession,
  createCheckoutSession,
  handleStripeWebhook,
  syncCheckoutSession,
} from "../../Business/services/StripeBillingService.js";
import logger from "../../Services/logging/logger.js";

function sendBillingError(err, reply) {
  const status = err.statusCode || 500;
  if (status >= 500) {
    logger.error({ err: err.message }, "Erreur billing Stripe");
  }
  return reply.code(status).send({ error: err.message });
}

export const CheckoutController = {
  async status() {
    return billingStatus();
  },

  async listPlans() {
    return { plans: await Plan.listActive() };
  },

  async startBeta(request, reply) {
    try {
      await ensureBetaTenant(request.user, {
        name: request.user.name || request.user.email,
      });
      const user = await User.findById(request.user.id);
      return reply.send(await sessionPayload(user));
    } catch (err) {
      return sendBillingError(err, reply);
    }
  },

  async createSession(request, reply) {
    try {
      const result = await createCheckoutSession({
        user: request.user,
        planSlug: request.body?.planSlug,
        planId: request.body?.planId,
        countryCode: request.body?.countryCode,
      });
      return reply.send(result);
    } catch (err) {
      return sendBillingError(err, reply);
    }
  },

  async portal(request, reply) {
    try {
      const result = await createBillingPortalSession({ user: request.user });
      return reply.send(result);
    } catch (err) {
      return sendBillingError(err, reply);
    }
  },

  async syncSession(request, reply) {
    try {
      await syncCheckoutSession({
        user: request.user,
        sessionId: request.body?.sessionId || request.body?.session_id,
      });
      const user = await User.findById(request.user.id);
      return reply.send(await sessionPayload(user));
    } catch (err) {
      return sendBillingError(err, reply);
    }
  },
};

export async function stripeWebhookHandler(request, reply) {
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
}
