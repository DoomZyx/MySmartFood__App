import {
  assertCanStartSelfServiceCheckout,
  assertStripeKeyMatchesEnv,
  automaticTaxEnabled,
  billingStatus,
  buildCheckoutSessionParams,
  checkoutIdempotencyKey,
  normalizeStripeWebhookSecret,
  stripeResourceId,
} from "./StripeBillingService.js";

const STRIPE_ENV_KEYS = [
  "APP_ENV",
  "STRIPE_AUTOMATIC_TAX",
  "STRIPE_SECRET_KEY",
  "STRIPE_SECRET_KEY_LIVE",
  "STRIPE_SECRET_KEY_TEST",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_WEBHOOK_SECRET_LIVE",
  "STRIPE_WEBHOOK_SECRET_TEST",
];

describe("StripeBillingService helpers", () => {
  const originalEnv = Object.fromEntries(
    STRIPE_ENV_KEYS.map((name) => [name, process.env[name]])
  );

  function restoreStripeEnv() {
    for (const name of STRIPE_ENV_KEYS) {
      if (originalEnv[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnv[name];
    }
  }

  beforeEach(() => {
    restoreStripeEnv();
    process.env.STRIPE_AUTOMATIC_TAX = "false";
  });

  afterEach(() => {
    restoreStripeEnv();
  });

  test("stripeResourceId accepte id string ou objet", () => {
    expect(stripeResourceId("sub_1")).toBe("sub_1");
    expect(stripeResourceId({ id: "sub_2" })).toBe("sub_2");
    expect(stripeResourceId(null)).toBe(null);
  });

  test("checkoutIdempotencyKey reste stable dans la fenêtre de 30s", () => {
    const now = 1_700_000_030_000;
    expect(
      checkoutIdempotencyKey({ userId: "u1", planId: "p1", tenantId: "t1", now })
    ).toBe(
      checkoutIdempotencyKey({ userId: "u1", planId: "p1", tenantId: "t1", now: now + 1000 })
    );
    expect(
      checkoutIdempotencyKey({ userId: "u1", planId: "p1", tenantId: "t1", now })
    ).not.toBe(
      checkoutIdempotencyKey({ userId: "u1", planId: "p1", tenantId: "t1", now: now + 31_000 })
    );
  });

  test("le plan demandé est collé dans la session, pas un fallback beta", () => {
    const params = buildCheckoutSessionParams({
      user: { id: "user-1", email: "a@b.c" },
      plan: { id: "plan-premium", slug: "premium" },
      priceId: "price_premium",
      customerId: null,
      tenantId: "tenant-1",
      countryCode: "FR",
    });
    expect(params.mode).toBe("subscription");
    expect(params.line_items[0].price).toBe("price_premium");
    expect(params.metadata.planSlug).toBe("premium");
    expect(params.metadata.tenantId).toBe("tenant-1");
    expect(params.customer_email).toBe("a@b.c");
    expect(params.automatic_tax).toBeUndefined();
    expect(params.managed_payments).toEqual({ enabled: false });
  });

  test("réutilise le customer Stripe au lieu de recréer un e-mail", () => {
    const params = buildCheckoutSessionParams({
      user: { id: "user-1", email: "a@b.c" },
      plan: { id: "plan-1", slug: "beta" },
      priceId: "price_beta",
      customerId: "cus_123",
      tenantId: null,
    });
    expect(params.customer).toBe("cus_123");
    expect(params.customer_email).toBeUndefined();
    expect(params.customer_update).toEqual({ address: "auto", name: "auto" });
  });

  test("TVA Stripe seulement si STRIPE_AUTOMATIC_TAX=true", () => {
    process.env.STRIPE_AUTOMATIC_TAX = "true";
    expect(automaticTaxEnabled()).toBe(true);
    const params = buildCheckoutSessionParams({
      user: { id: "user-1", email: "a@b.c" },
      plan: { id: "plan-1", slug: "beta" },
      priceId: "price_beta",
    });
    expect(params.automatic_tax).toEqual({ enabled: true });
    expect(params.billing_address_collection).toBe("required");
  });

  test("un resto BO ne peut pas passer par le checkout vitrine", () => {
    expect(() =>
      assertCanStartSelfServiceCheckout([
        { status: "active", onboardedBy: "platform" },
      ])
    ).toThrow(/back-office/);
  });

  test("billingStatus ne fuit pas les secrets", () => {
    const status = billingStatus();
    expect(status.ok).toBe(true);
    expect(status).not.toHaveProperty("secret");
    expect(JSON.stringify(status)).not.toMatch(/sk_|whsec_/);
  });

  test("normalizeStripeWebhookSecret garde le premier whsec_ si deux sont collés", () => {
    expect(normalizeStripeWebhookSecret("whsec_abc123whsec_abc123")).toBe("whsec_abc123");
    expect(normalizeStripeWebhookSecret("hsec_abc123")).toBe("whsec_abc123");
  });

  test("preprod et dev rejettent une clé live, prod l'exige", () => {
    process.env.APP_ENV = "preprod";
    expect(() => assertStripeKeyMatchesEnv("sk_live_placeholder")).toThrow(/hors prod/);
    try {
      assertStripeKeyMatchesEnv("sk_live_placeholder");
    } catch (err) {
      expect(err.statusCode).toBe(503);
    }
    expect(() => assertStripeKeyMatchesEnv("sk_test_placeholder")).not.toThrow();

    process.env.APP_ENV = "dev";
    expect(() => assertStripeKeyMatchesEnv("sk_live_placeholder")).toThrow(/hors prod/);
    expect(() => assertStripeKeyMatchesEnv("sk_test_placeholder")).not.toThrow();

    process.env.APP_ENV = "prod";
    expect(() => assertStripeKeyMatchesEnv("sk_test_placeholder")).toThrow(/live/);
    expect(() => assertStripeKeyMatchesEnv("sk_live_placeholder")).not.toThrow();
  });

  test("hors prod, billingStatus lit STRIPE_SECRET_KEY_TEST avant STRIPE_SECRET_KEY", () => {
    process.env.APP_ENV = "preprod";
    process.env.STRIPE_SECRET_KEY_TEST = "sk_test_placeholder";
    process.env.STRIPE_SECRET_KEY = "sk_live_placeholder";
    process.env.STRIPE_SECRET_KEY_LIVE = "sk_live_placeholder";
    process.env.STRIPE_WEBHOOK_SECRET_TEST = "whsec_placeholder";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_other";
    const status = billingStatus();
    expect(status.mode).toBe("test");
    expect(status.testMode).toBe(true);
    expect(status.webhookConfigured).toBe(true);
    expect(JSON.stringify(status)).not.toMatch(/sk_|whsec_/);
  });

  test("prod, billingStatus lit STRIPE_SECRET_KEY_LIVE avant les clés test", () => {
    process.env.APP_ENV = "prod";
    process.env.STRIPE_SECRET_KEY_LIVE = "sk_live_placeholder";
    process.env.STRIPE_SECRET_KEY_TEST = "sk_test_placeholder";
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    const status = billingStatus();
    expect(status.mode).toBe("live");
    expect(status.testMode).toBe(false);
    expect(JSON.stringify(status)).not.toMatch(/sk_|whsec_/);
  });
});
