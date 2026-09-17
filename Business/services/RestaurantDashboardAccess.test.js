import {
  hasActiveRestaurantAccess,
  isPaidSubscription,
  isPlatformProvisionedAccess,
  isRestaurantDashboardReady,
} from "./RestaurantDashboardAccess.js";

describe("RestaurantDashboardAccess", () => {
  const paid = { stripeSubscriptionId: "sub_1", status: "active" };
  const platformActive = { onboardedBy: "platform", status: "active" };

  test("self-service reste bloqué sans Stripe ni dossier", () => {
    const self = { onboardedBy: "self", status: "pending_compliance" };
    expect(isPaidSubscription({ status: "active" })).toBe(false);
    expect(isRestaurantDashboardReady({ status: "active" }, null, self)).toBe(false);
    expect(hasActiveRestaurantAccess({ status: "active" }, self)).toBe(false);
  });

  test("self-service prêt seulement avec Stripe + dossier", () => {
    expect(isPaidSubscription(paid)).toBe(true);
    expect(isRestaurantDashboardReady(paid, "2026-01-01", { onboardedBy: "self", status: "active" }))
      .toBe(true);
    expect(isRestaurantDashboardReady(paid, null, { onboardedBy: "self", status: "active" }))
      .toBe(false);
  });

  test("client onboardé plateforme actif : dashboard sans Stripe ni KBIS", () => {
    expect(isPlatformProvisionedAccess(platformActive)).toBe(true);
    expect(isPaidSubscription({ status: "active" })).toBe(false);
    expect(hasActiveRestaurantAccess({ status: "active" }, platformActive)).toBe(true);
    expect(isRestaurantDashboardReady({ status: "active" }, null, platformActive)).toBe(true);
  });

  test("client onboardé plateforme suspendu : pas d'accès", () => {
    const suspended = { onboardedBy: "platform", status: "suspended" };
    expect(isPlatformProvisionedAccess(suspended)).toBe(false);
    expect(isRestaurantDashboardReady({ status: "active" }, null, suspended)).toBe(false);
  });
});
