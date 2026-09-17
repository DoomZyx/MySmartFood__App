import * as EstablishmentProfile from "../../models/pg/EstablishmentProfile.js";
import * as Subscription from "../../models/pg/Subscription.js";
import * as Tenant from "../../models/pg/Tenant.js";
import * as User from "../../models/pg/User.js";

export function isPlatformProvisionedAccess(tenant) {
  return tenant?.onboardedBy === "platform" && tenant?.status === "active";
}

export function isPaidSubscription(subscription) {
  return Boolean(
    subscription?.stripeSubscriptionId &&
      Subscription.isAccessGranted(subscription.status)
  );
}

export function hasActiveRestaurantAccess(subscription, tenant) {
  return isPaidSubscription(subscription) || isPlatformProvisionedAccess(tenant);
}

export function isRestaurantDashboardReady(subscription, documentsSubmittedAt, tenant) {
  if (isPlatformProvisionedAccess(tenant)) return true;
  return (
    tenant?.status === "active" &&
    isPaidSubscription(subscription) &&
    Boolean(documentsSubmittedAt)
  );
}

export async function refreshDashboardUnlock(userId, tenantId) {
  if (!userId || !tenantId) return false;
  const [subscription, profile, tenant] = await Promise.all([
    Subscription.findCurrentByTenant(tenantId),
    EstablishmentProfile.findByTenantId(tenantId),
    Tenant.findById(tenantId),
  ]);
  const ready = isRestaurantDashboardReady(
    subscription,
    profile?.documentsSubmittedAt,
    tenant
  );
  if (ready) {
    await User.markDashboardUnlocked(userId);
  }
  return ready;
}
