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
import { refreshDashboardUnlock } from "./RestaurantDashboardAccess.js";
import logger from "../../Services/logging/logger.js";

function isProdApp() {
  return process.env.APP_ENV === "prod";
}

function firstEnvValue(...names) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function extractStripeSecret(raw) {
  const parts = String(raw || "")
    .split(/(?=sk_(?:test|live)_)/)
    .map((part) => part.replace(/[^A-Za-z0-9_]/g, ""))
    .filter((part) => /^sk_(?:test|live)_/.test(part));
  return parts[parts.length - 1] || String(raw || "").trim();
}

export function normalizeStripeWebhookSecret(raw) {
  let text = String(raw || "").trim();
  if (text.startsWith("hsec_")) text = `w${text}`;
  const match = text.match(/whsec_[A-Za-z0-9]+?(?=whsec_|$)/);
  return match ? match[0] : text;
}

function stripeSecretKey() {
  const raw = isProdApp()
    ? firstEnvValue("STRIPE_SECRET_KEY_LIVE", "STRIPE_SECRET_KEY")
    : firstEnvValue("STRIPE_SECRET_KEY_TEST", "STRIPE_SECRET_KEY");
  return extractStripeSecret(raw);
}

function stripeWebhookSecret() {
  const raw = isProdApp()
    ? firstEnvValue("STRIPE_WEBHOOK_SECRET_LIVE", "STRIPE_WEBHOOK_SECRET")
    : firstEnvValue("STRIPE_WEBHOOK_SECRET_TEST", "STRIPE_WEBHOOK_SECRET");
  return normalizeStripeWebhookSecret(raw);
}

function isStripeTestMode() {
  return stripeSecretKey().startsWith("sk_test_");
}

export function assertStripeKeyMatchesEnv(key) {
  const env = process.env.APP_ENV;
  if (env === "prod" && !key.startsWith("sk_live_")) {
    const err = new Error("Stripe prod exige une clé live (sk_live_ / STRIPE_SECRET_KEY_LIVE)");
    err.statusCode = 503;
    throw err;
  }
  if (env !== "prod" && key.startsWith("sk_live_")) {
    const err = new Error("Stripe hors prod exige une clé test (sk_test_ / STRIPE_SECRET_KEY_TEST)");
    err.statusCode = 503;
    throw err;
  }
}

function stripeClient() {
  const key = stripeSecretKey();
  if (!key) {
    const err = new Error("Paiement non configuré");
    err.statusCode = 503;
    throw err;
  }
  assertStripeKeyMatchesEnv(key);
  return new Stripe(key);
}

export function stripeResourceId(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const text = value.trim();
    return text || null;
  }
  if (typeof value === "object" && value.id) {
    return String(value.id);
  }
  return null;
}

export function checkoutIdempotencyKey({ userId, planId, tenantId, now = Date.now() }) {
  const window = Math.floor(Number(now) / 30_000);
  return `chk_${userId}_${planId}_${tenantId || "none"}_${window}`;
}

export function automaticTaxEnabled() {
  return String(process.env.STRIPE_AUTOMATIC_TAX || "").trim() === "true";
}

export function billingStatus() {
  const key = stripeSecretKey();
  const webhook = stripeWebhookSecret();
  return {
    ok: true,
    configured: Boolean(key),
    webhookConfigured: Boolean(webhook),
    mode: key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : "unset",
    testMode: isStripeTestMode(),
  };
}

export function assertCanStartSelfServiceCheckout(tenants = []) {
  const managed = tenants.some(
    (tenant) => tenant?.onboardedBy === "platform" && tenant?.status === "active"
  );
  if (!managed) return;
  const err = new Error("Compte géré par le back-office : paiement vitrine indisponible");
  err.statusCode = 409;
  throw err;
}

export function buildCheckoutSessionParams({
  user,
  plan,
  priceId,
  customerId = null,
  tenantId = null,
  countryCode,
}) {
  const metadata = {
    userId: user.id,
    planId: plan.id,
    planSlug: plan.slug,
  };
  if (tenantId) metadata.tenantId = tenantId;
  if (countryCode && ["FR", "BE", "LU"].includes(countryCode)) {
    metadata.countryCode = countryCode;
  }

  const params = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl()}/mon-espace?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/pricing?checkout=cancelled`,
    locale: "fr",
    allow_promotion_codes: true,
    client_reference_id: user.id,
    metadata,
    subscription_data: { metadata },
  };

  if (customerId) {
    params.customer = customerId;
    params.customer_update = { address: "auto", name: "auto" };
  } else if (user.email) {
    params.customer_email = user.email;
  }

  if (automaticTaxEnabled()) {
    params.automatic_tax = { enabled: true };
    params.billing_address_collection = "required";
  } else {
    params.managed_payments = { enabled: false };
  }

  return params;
}

function asStripePriceId(value) {
  const text = String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  return /^price_[A-Za-z0-9]+$/.test(text) ? text : null;
}

function asStripeProductId(value) {
  const text = String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  return /^prod_[A-Za-z0-9]+$/.test(text) ? text : null;
}

function catalogIdFromEnv(plan) {
  const slug = String(plan.slug || "").toUpperCase();
  const websiteId = websitePlanIdFromSlug(plan.slug);
  const names = [
    `STRIPE_PRICE_${slug}`,
    websiteId ? `STRIPE_PRICE_PLAN_${websiteId}` : null,
    isProdApp() ? "STRIPE_PRICE_BETA_LIVE" : "STRIPE_PRICE_BETA_TEST",
    "STRIPE_PRICE_BETA",
  ].filter(Boolean);
  for (const name of names) {
    const raw = String(process.env[name] || "")
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!raw) continue;
    const priceId = asStripePriceId(raw);
    if (priceId) return { type: "price", id: priceId, source: name };
    const productId = asStripeProductId(raw);
    if (productId) return { type: "product", id: productId, source: name };
    return { type: "unknown", id: raw, source: name };
  }
  return null;
}

async function monthlyPriceForProduct(stripe, productId) {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    type: "recurring",
    limit: 20,
  });
  const monthly = prices.data.find((item) => item.recurring?.interval === "month");
  return asStripePriceId(monthly?.id || prices.data[0]?.id);
}

async function resolvePriceId(stripe, plan) {
  let priceId = asStripePriceId(plan.stripePriceId);
  if (!priceId && asStripeProductId(plan.stripeProductId)) {
    priceId = await monthlyPriceForProduct(stripe, plan.stripeProductId);
  }
  if (priceId) return priceId;

  const fromEnv = catalogIdFromEnv(plan);
  if (!fromEnv) return null;
  if (fromEnv.type === "price") return fromEnv.id;
  if (fromEnv.type === "product") {
    const resolved = await monthlyPriceForProduct(stripe, fromEnv.id);
    if (resolved) return resolved;
    const err = new Error(
      `${fromEnv.source} pointe vers un produit sans tarif récurrent actif. ` +
        "Ouvre le produit dans Stripe Live et copie l'id du Price (price_...)."
    );
    err.statusCode = 503;
    throw err;
  }
  const prefix = fromEnv.id.slice(0, 8);
  const err = new Error(
    `${fromEnv.source} doit commencer par price_ ou prod_. Valeur actuelle: ${prefix}...`
  );
  err.statusCode = 503;
  throw err;
}

async function listUserTenants(userId) {
  const memberships = await Membership.listByUserId(userId);
  return memberships.map((item) => ({
    id: item.tenantId,
    status: item.status,
    onboardedBy: item.onboardedBy || "self",
  }));
}

async function findReusableStripeCustomerId(userId) {
  const memberships = await Membership.listByUserId(userId);
  for (const item of memberships) {
    const subscription = await Subscription.findCurrentByTenant(item.tenantId);
    if (subscription?.stripeCustomerId) {
      return subscription.stripeCustomerId;
    }
  }
  return null;
}

async function findCheckoutTenantId(userId) {
  const memberships = await Membership.listByUserId(userId);
  for (const item of memberships) {
    if (item.status === "closed") continue;
    const subscription = await Subscription.findCurrentByTenant(item.tenantId);
    if (!subscription?.stripeSubscriptionId) {
      return item.tenantId;
    }
  }
  return memberships.find((item) => item.status !== "closed")?.tenantId || null;
}

export async function createCheckoutSession({ user, planSlug, planId, countryCode }) {
  const tenants = await listUserTenants(user.id);
  assertCanStartSelfServiceCheckout(tenants);

  const slug = resolvePlanSlug({ planSlug, planId });
  if (!slug && !isStripeTestMode()) {
    const err = new Error("Plan invalide");
    err.statusCode = 400;
    throw err;
  }

  let plan = slug ? await Plan.findBySlug(slug) : null;
  if (!plan && isStripeTestMode()) {
    plan = await Plan.findBySlug("beta");
  }
  if (!plan) {
    const err = new Error("Plan invalide");
    err.statusCode = 400;
    throw err;
  }

  const stripe = stripeClient();
  const priceId = await resolvePriceId(stripe, plan);
  if (!priceId) {
    const err = new Error(
      `Configuration Stripe manquante pour le plan ${plan.slug}. ` +
        "Dans le .env lu par PM2, mettre un ID Price live (price_...), pas un Product (prod_...)."
    );
    err.statusCode = 503;
    throw err;
  }

  const tenantId = await findCheckoutTenantId(user.id);
  const customerId = await findReusableStripeCustomerId(user.id);
  const params = buildCheckoutSessionParams({
    user,
    plan,
    priceId,
    customerId,
    tenantId,
    countryCode,
  });

  const session = await stripe.checkout.sessions.create(params, {
    idempotencyKey: checkoutIdempotencyKey({
      userId: user.id,
      planId: plan.id,
      tenantId,
    }),
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
  let subscriptionId = stripeResourceId(session.subscription);
  if (!subscriptionId && session.id) {
    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["subscription"],
    });
    subscriptionId = stripeResourceId(full.subscription);
  }
  if (!userId || !planId || !subscriptionId) {
    logger.warn({ sessionId: session.id }, "Webhook checkout incomplet");
    return;
  }

  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
  const plan = await Plan.findById(planId);
  if (!plan) return;

  let tenantId = session.metadata?.tenantId || null;
  await withTransaction(async (client) => {
    if (tenantId) {
      const owned = await client.query(
        `SELECT id FROM tenants WHERE id = $1 AND owner_user_id = $2 AND status <> 'closed'`,
        [tenantId, userId]
      );
      tenantId = owned.rows[0]?.id || null;
    }
    if (!tenantId) {
      const unpaid = await client.query(
        `SELECT t.id
           FROM tenants t
           LEFT JOIN subscriptions s ON s.tenant_id = t.id
          WHERE t.owner_user_id = $1
            AND t.status <> 'closed'
            AND s.stripe_subscription_id IS NULL
          ORDER BY t.created_at ASC
          LIMIT 1`,
        [userId]
      );
      tenantId = unpaid.rows[0]?.id || null;
    }
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
        stripeResourceId(session.customer),
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
      stripeCustomerId: stripeResourceId(session.customer),
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

  if (tenantId) {
    try {
      await stripe.subscriptions.update(subscriptionId, {
        metadata: {
          userId,
          planId,
          planSlug: plan.slug,
          tenantId,
        },
      });
    } catch (err) {
      logger.error({ err: err.message, tenantId }, "Metadata Stripe tenant absente");
    }
  }

  if (tenantId && Subscription.isAccessGranted(stripeSub.status)) {
    try {
      const unlocked = await refreshDashboardUnlock(userId, tenantId);
      if (unlocked) {
        await issueDashboardAccessToken({ userId, tenantId });
      }
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
    stripeCustomerId: stripeResourceId(stripeSub.customer),
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

function checkoutOwnerId(session) {
  return session?.client_reference_id || session?.metadata?.userId || null;
}

async function resolvePlanIdForSubscription(userId, stripeSub) {
  if (stripeSub?.metadata?.planId) return stripeSub.metadata.planId;
  const tenantId = await findCheckoutTenantId(userId);
  if (tenantId) {
    const existing = await Subscription.findCurrentByTenant(tenantId);
    if (existing?.planId) return existing.planId;
  }
  const fallback = (await Plan.findBySlug("beta")) || (await Plan.findBySlug("developpeur"));
  return fallback?.id || null;
}

async function findStripeSubscriptionsForUser(stripe, user) {
  const safeUserId = String(user.id).replace(/[^a-zA-Z0-9-]/g, "");
  if (safeUserId && typeof stripe.subscriptions?.search === "function") {
    try {
      const found = await stripe.subscriptions.search({
        query: `metadata["userId"]:"${safeUserId}"`,
        limit: 10,
      });
      return (found.data || []).filter((item) => Subscription.isAccessGranted(item.status));
    } catch (err) {
      logger.warn({ err: err.message }, "Recherche abonnements Stripe indisponible");
    }
  }

  const customers = await stripe.customers.list({ email: user.email, limit: 10 });
  const collected = [];
  for (const customer of customers.data || []) {
    const list = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 10,
    });
    for (const item of list.data || []) {
      const owner = item.metadata?.userId;
      if (owner && owner !== user.id) continue;
      if (!Subscription.isAccessGranted(item.status)) continue;
      collected.push(item);
    }
  }
  return collected;
}

async function applyPaidSubscription(stripe, user, stripeSub) {
  const existing = await Subscription.findByStripeSubscriptionId(stripeSub.id);
  if (existing) return;
  const planId = await resolvePlanIdForSubscription(user.id, stripeSub);
  if (!planId) return;
  await onCheckoutCompleted(stripe, {
    id: null,
    client_reference_id: user.id,
    metadata: {
      userId: user.id,
      planId,
      planSlug: stripeSub.metadata?.planSlug,
      tenantId: stripeSub.metadata?.tenantId,
      countryCode: stripeSub.metadata?.countryCode,
    },
    subscription: stripeSub.id,
    customer: stripeResourceId(stripeSub.customer),
  });
}

export async function syncCheckoutSession({ user, sessionId }) {
  if (!user?.id) {
    const err = new Error("Authentification requise");
    err.statusCode = 401;
    throw err;
  }

  const stripe = stripeClient();
  const rawId = String(sessionId || "").trim();
  if (rawId) {
    if (!/^cs_[A-Za-z0-9]+$/.test(rawId)) {
      const err = new Error("Session de paiement invalide");
      err.statusCode = 400;
      throw err;
    }
    const session = await stripe.checkout.sessions.retrieve(rawId, {
      expand: ["subscription"],
    });
    const ownerId = checkoutOwnerId(session);
    if (!ownerId || ownerId !== user.id) {
      const err = new Error(
        "Ce paiement est lié à un autre compte. Connectez-vous avec le compte utilisé lors du règlement."
      );
      err.statusCode = 403;
      throw err;
    }
    if (session.status !== "complete" && session.payment_status !== "paid") {
      const err = new Error("Le paiement n'est pas encore confirmé");
      err.statusCode = 409;
      throw err;
    }
    await onCheckoutCompleted(stripe, session);
    return { synced: true };
  }

  const subscriptions = await findStripeSubscriptionsForUser(stripe, user);
  for (const stripeSub of subscriptions) {
    await applyPaidSubscription(stripe, user, stripeSub);
  }
  return { synced: true };
}

export async function createBillingPortalSession({ user }) {
  const memberships = await Membership.listByUserId(user.id);
  let customerId = null;
  for (const item of memberships) {
    const subscription = await Subscription.findCurrentByTenant(item.tenantId);
    if (subscription?.stripeCustomerId) {
      customerId = subscription.stripeCustomerId;
      break;
    }
  }
  if (!customerId) {
    const err = new Error("Aucun client Stripe pour ce compte");
    err.statusCode = 404;
    throw err;
  }
  const portal = await stripeClient().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl()}/mon-espace`,
  });
  if (!portal.url) {
    const err = new Error("Impossible d'ouvrir le portail de facturation");
    err.statusCode = 500;
    throw err;
  }
  return { url: portal.url };
}
