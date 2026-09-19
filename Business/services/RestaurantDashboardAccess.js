import * as EstablishmentProfile from "../../models/pg/EstablishmentProfile.js";
import * as Plan from "../../models/pg/Plan.js";
import * as Subscription from "../../models/pg/Subscription.js";
import * as Tenant from "../../models/pg/Tenant.js";
import * as User from "../../models/pg/User.js";

export function isPlatformProvisionedAccess(tenant) {
  return tenant?.onboardedBy === "platform" && tenant?.status === "active";
}

export function isBoValidatedAccess(tenant, user) {
  return tenant?.status === "active" && Boolean(user?.dashboardUnlockedAt);
}

export function isPaidSubscription(subscription) {
  return Boolean(
    subscription?.stripeSubscriptionId &&
      Subscription.isAccessGranted(subscription.status)
  );
}

export function isDeveloperPlan(plan) {
  return String(plan?.slug || "").toLowerCase() === "developpeur";
}

export function canBypassDossierLock(user, plan) {
  if (user?.isPlatformOwner) return true;
  return isDeveloperPlan(plan);
}

export function hasDeveloperAccess(subscription, plan, user) {
  if (user?.isPlatformOwner) return true;
  return isDeveloperPlan(plan) && Subscription.isAccessGranted(subscription?.status);
}

export function hasActiveRestaurantAccess(subscription, tenant, plan, user) {
  return (
    isPaidSubscription(subscription) ||
    isPlatformProvisionedAccess(tenant) ||
    hasDeveloperAccess(subscription, plan, user)
  );
}

export function isRestaurantDashboardReady(
  subscription,
  documentsSubmittedAt,
  tenant,
  user,
  plan
) {
  if (hasDeveloperAccess(subscription, plan, user) && tenant?.status === "active") {
    return true;
  }
  if (isPlatformProvisionedAccess(tenant)) return true;
  if (isBoValidatedAccess(tenant, user)) return true;
  return (
    tenant?.status === "active" &&
    isPaidSubscription(subscription) &&
    Boolean(documentsSubmittedAt)
  );
}

export async function refreshDashboardUnlock(userId, tenantId) {
  if (!userId || !tenantId) return false;
  const [subscription, profile, tenant, user] = await Promise.all([
    Subscription.findCurrentByTenant(tenantId),
    EstablishmentProfile.findByTenantId(tenantId),
    Tenant.findById(tenantId),
    User.findById(userId),
  ]);
  const plan = subscription?.planId ? await Plan.findById(subscription.planId) : null;
  const ready = isRestaurantDashboardReady(
    subscription,
    profile?.documentsSubmittedAt,
    tenant,
    user,
    plan
  );
  if (ready) {
    await User.markDashboardUnlocked(userId);
  }
  return ready;
}
