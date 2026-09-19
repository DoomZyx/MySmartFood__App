import {
  canBypassDossierLock,
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

  test("self-service prêt seulement avec Stripe + dossier + validation", () => {
    expect(isPaidSubscription(paid)).toBe(true);
    expect(isRestaurantDashboardReady(paid, "2026-01-01", { onboardedBy: "self", status: "active" }))
      .toBe(true);
    expect(isRestaurantDashboardReady(paid, null, { onboardedBy: "self", status: "active" }))
      .toBe(false);
    expect(
      isRestaurantDashboardReady(paid, "2026-01-01", {
        onboardedBy: "self",
        status: "pending_compliance",
      })
    ).toBe(false);
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

  test("self-service accepté en back-office : dashboard même sans Stripe encore enregistré", () => {
    const selfActive = { onboardedBy: "self", status: "active" };
    const unlocked = { dashboardUnlockedAt: "2026-09-18T00:00:00.000Z" };
    expect(isRestaurantDashboardReady({ status: "incomplete" }, "2026-01-01", selfActive, unlocked))
      .toBe(true);
    expect(isRestaurantDashboardReady({ status: "incomplete" }, "2026-01-01", selfActive))
      .toBe(false);
    expect(
      isRestaurantDashboardReady(
        { status: "incomplete" },
        "2026-01-01",
        { onboardedBy: "self", status: "suspended" },
        unlocked
      )
    ).toBe(false);
  });

  test("abonnement développeur : dashboard sans Stripe ni dossier", () => {
    const tenant = { onboardedBy: "self", status: "active" };
    const sub = { status: "active" };
    const plan = { slug: "developpeur" };
    expect(hasActiveRestaurantAccess(sub, tenant, plan)).toBe(true);
    expect(isRestaurantDashboardReady(sub, null, tenant, {}, plan)).toBe(true);
  });

  test("propriétaire plateforme : dashboard sans parcours client", () => {
    const tenant = { onboardedBy: "self", status: "active" };
    const owner = { isPlatformOwner: true };
    expect(hasActiveRestaurantAccess({ status: "incomplete" }, tenant, null, owner)).toBe(true);
    expect(isRestaurantDashboardReady({ status: "incomplete" }, null, tenant, owner)).toBe(true);
  });

  test("propriétaire et plan développeur peuvent renvoyer un dossier verrouillé", () => {
    expect(canBypassDossierLock({ isPlatformOwner: true }, null)).toBe(true);
    expect(canBypassDossierLock({}, { slug: "developpeur" })).toBe(true);
    expect(canBypassDossierLock({}, { slug: "beta" })).toBe(false);
    expect(canBypassDossierLock({ isPlatformAdmin: true }, { slug: "beta" })).toBe(false);
  });

  test("admin plateforme sans plan développeur : pas d'accès dashboard", () => {
    const tenant = { onboardedBy: "self", status: "active" };
    const admin = { isPlatformAdmin: true };
    const beta = { slug: "beta" };
    expect(hasActiveRestaurantAccess({ status: "incomplete" }, tenant, beta, admin)).toBe(false);
    expect(isRestaurantDashboardReady({ status: "incomplete" }, null, tenant, admin, beta)).toBe(false);
  });
});
