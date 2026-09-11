import Stripe from "stripe";
import { getPool } from "../../database/pool.js";
import { withTenant, withTransaction } from "../../database/transaction.js";
import * as Plan from "../../models/pg/Plan.js";
import * as Tenant from "../../models/pg/Tenant.js";
import * as Membership from "../../models/pg/Membership.js";
import * as Subscription from "../../models/pg/Subscription.js";
import { createProvisioningJob } from "../../models/pg/ProvisioningJob.js";
import { resolvePlanSlug, websitePlanIdFromSlug } from "../mappers/websitePlan.js";
import { siteUrl } from "../../utils/publicUrls.js";
import { issueDashboardAccessToken } from "./DashboardAccessService.js";
import logger from "../../Services/logging/logger.js";

function stripeSecretKey() {
  const raw = String(process.env.STRIPE_SECRET_KEY || "").trim();
  const parts = raw
    .split(/(?=sk_(?:test|live)_)/)
    .map((part) => part.replace(/[^A-Za-z0-9_]/g, ""))
    .filter((part) => /^sk_(?:test|live)_/.test(part));
  return parts[parts.length - 1] || raw;
}

function stripeWebhookSecret() {
  const raw = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (raw.startsWith("hsec_")) return `w${raw}`;
  return raw;
}

function isStripeTestMode() {
  const key = stripeSecretKey();
  return key.startsWith("sk_test_") || process.env.APP_ENV !== "prod";
}

function stripeClient() {
  const key = stripeSecretKey();
  if (!key) {
    const err = new Error("Paiement non configuré");
    err.statusCode = 503;
    throw err;
  }
  return new Stripe(key);
}

async function resolvePriceId(stripe, plan) {
  let priceId = plan.stripePriceId;
  if (!priceId && plan.stripeProductId) {
    const prices = await stripe.prices.list({
      product: plan.stripeProductId,
      active: true,
      type: "recurring",
    });
    priceId = prices.data.find((item) => item.recurring?.interval === "month")?.id;
  }
  if (!priceId) {
    const envPrice = process.env[`STRIPE_PRICE_${plan.slug.toUpperCase()}`];
    const websiteId = websitePlanIdFromSlug(plan.slug);
    const websitePrice = websiteId ? process.env[`STRIPE_PRICE_PLAN_${websiteId}`] : null;
    priceId = envPrice || websitePrice || null;
  }
  if (!priceId) {
    priceId = process.env.STRIPE_PRICE_BETA || null;
  }
  return priceId || null;
}

export async function createCheckoutSession({ user, planSlug, planId, countryCode }) {
  const slug = resolvePlanSlug({ planSlug, planId });
  if (!slug && !isStripeTestMode()) {
    const err = new Error("Plan invalide");
    err.statusCode = 400;
    throw err;
  }

  let plan = slug ? await Plan.findBySlug(slug) : null;
  if (isStripeTestMode()) {
    const betaPlan = await Plan.findBySlug("beta");
    if (betaPlan) plan = betaPlan;
  }
  if (!plan) {
    const err = new Error("Plan invalide");
    err.statusCode = 400;
    throw err;
  }

  const stripe = stripeClient();
  const priceId = await resolvePriceId(stripe, plan);
  if (!priceId) {
    const err = new Error("Configuration Stripe manquante pour ce plan");
    err.statusCode = 503;
    throw err;
  }

  const metadata = {
    userId: user.id,
    planId: plan.id,
    planSlug: plan.slug,
  };
  if (countryCode && ["FR", "BE", "LU"].includes(countryCode)) {
    metadata.countryCode = countryCode;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl()}/mon-espace?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/pricing?checkout=cancelled`,
    locale: "fr",
    allow_promotion_codes: true,
    client_reference_id: user.id,
    customer_email: user.email,
    metadata,
  });

  if (!session.url) {
    const err = new Error("Impossible de créer la session de paiement");
    err.statusCode = 500;
    throw err;
  }
  return { url: session.url };
}

export async function handleStripeWebhook(rawBody, signature) {
  const webhookSecret = stripeWebhookSecret();
  if (!stripeSecretKey() || !webhookSecret) {
    const err = new Error("Webhook non configuré");
    err.statusCode = 503;
    throw err;
  }
  if (!signature) {
    const err = new Error("En-tête stripe-signature manquant");
    err.statusCode = 400;
    throw err;
  }

  const stripe = stripeClient();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    const err = new Error("Signature webhook invalide");
    err.statusCode = 400;
    throw err;
  }

  const inserted = await getPool().query(
    `INSERT INTO stripe_webhook_events (event_id, event_type)
     VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [event.id, event.type]
  );
  if (inserted.rowCount === 0) {
    return { duplicate: true };
  }

  try {
    if (event.type === "checkout.session.completed") {
      await onCheckoutCompleted(stripe, event.data.object);
    } else if (event.type === "customer.subscription.updated") {
      await onSubscriptionUpdated(event.data.object);
    } else if (event.type === "customer.subscription.deleted") {
      await onSubscriptionDeleted(event.data.object);
    }
  } catch (err) {
    await getPool().query("DELETE FROM stripe_webhook_events WHERE event_id = $1", [event.id]);
    throw err;
  }

  return { processed: event.type };
}

async function onCheckoutCompleted(stripe, session) {
  const userId = session.client_reference_id || session.metadata?.userId;
  const planId = session.metadata?.planId;
  const countryCode = session.metadata?.countryCode || "FR";
  const subscriptionId = session.subscription;
  if (!userId || !planId || !subscriptionId) {
    logger.warn({ sessionId: session.id }, "Webhook checkout incomplet");
    return;
  }

  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
  const plan = await Plan.findById(planId);
  if (!plan) return;

  let tenantId = null;
  await withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM tenants WHERE owner_user_id = $1 AND status <> 'closed' LIMIT 1`,
      [userId]
    );
    tenantId = existing.rows[0]?.id;
    if (!tenantId) {
      const tenant = await Tenant.createTenant(client, {
        slug: Tenant.slugFromName(session.customer_details?.name || "etablissement", userId.slice(0, 8)),
        name: session.customer_details?.name || "Établissement",
        ownerUserId: userId,
        countryCode,
        status: "pending_compliance",
      });
      tenantId = tenant.id;
      await Membership.createMembership(client, {
        tenantId,
        userId,
        role: "owner",
      });
      await createProvisioningJob(client, tenantId);
    }

    const linked = await client.query(
      `UPDATE subscriptions
          SET plan_id = $2,
              stripe_customer_id = $3,
              stripe_subscription_id = $4,
              status = $5,
              current_period_start = $6,
              current_period_end = $7,
              cancel_at_period_end = $8
        WHERE tenant_id = $1
          AND stripe_subscription_id IS NULL
        RETURNING id`,
      [
        tenantId,
        plan.id,
        session.customer || null,
        subscriptionId,
        stripeSub.status,
        stripeSub.current_period_start
          ? new Date(stripeSub.current_period_start * 1000)
          : null,
        stripeSub.current_period_end
          ? new Date(stripeSub.current_period_end * 1000)
          : null,
        Boolean(stripeSub.cancel_at_period_end),
      ]
    );
    if (linked.rowCount > 0) {
      return;
    }

    await Subscription.upsertFromStripe(client, {
      tenantId,
      planId: plan.id,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: subscriptionId,
      status: stripeSub.status,
      currentPeriodStart: stripeSub.current_period_start
        ? new Date(stripeSub.current_period_start * 1000)
        : null,
      currentPeriodEnd: stripeSub.current_period_end
        ? new Date(stripeSub.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
    });
  });

  await withTenant(tenantId, (tenantClient) =>
    tenantClient.query(
      `INSERT INTO tenant_settings (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [tenantId]
    )
  );

  if (tenantId && Subscription.isAccessGranted(stripeSub.status)) {
    try {
      await issueDashboardAccessToken({ userId, tenantId });
    } catch (err) {
      logger.error({ err: err.message, userId }, "Émission jeton d'accès échouée");
    }
  }
}

async function onSubscriptionUpdated(stripeSub) {
  const existing = await Subscription.findByStripeSubscriptionId(stripeSub.id);
  if (!existing) return;
  await Subscription.upsertFromStripe(null, {
    tenantId: existing.tenantId,
    planId: existing.planId,
    stripeCustomerId: stripeSub.customer,
    stripeSubscriptionId: stripeSub.id,
    status: stripeSub.status,
    currentPeriodStart: stripeSub.current_period_start
      ? new Date(stripeSub.current_period_start * 1000)
      : null,
    currentPeriodEnd: stripeSub.current_period_end
      ? new Date(stripeSub.current_period_end * 1000)
      : null,
    cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
    canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
  });
  if (!Subscription.isAccessGranted(stripeSub.status)) {
    await Tenant.updateStatus(null, existing.tenantId, "suspended");
  }
}

async function onSubscriptionDeleted(stripeSub) {
  const existing = await Subscription.findByStripeSubscriptionId(stripeSub.id);
  await Subscription.markCanceled(stripeSub.id);
  if (existing) {
    await Tenant.updateStatus(null, existing.tenantId, "suspended");
  }
}
