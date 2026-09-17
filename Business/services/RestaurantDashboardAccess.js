import * as EstablishmentProfile from "../../models/pg/EstablishmentProfile.js";
import * as Subscription from "../../models/pg/Subscription.js";
import * as User from "../../models/pg/User.js";

export function isPaidSubscription(subscription) {
  return Boolean(
    subscription?.stripeSubscriptionId &&
      Subscription.isAccessGranted(subscription.status)
  );
}

export function isRestaurantDashboardReady(subscription, documentsSubmittedAt) {
  return isPaidSubscription(subscription) && Boolean(documentsSubmittedAt);
}

export async function refreshDashboardUnlock(userId, tenantId) {
  if (!userId || !tenantId) return false;
  const subscription = await Subscription.findCurrentByTenant(tenantId);
  const profile = await EstablishmentProfile.findByTenantId(tenantId);
  const ready = isRestaurantDashboardReady(
    subscription,
    profile?.documentsSubmittedAt
  );
  if (ready) {
    await User.markDashboardUnlocked(userId);
  }
  return ready;
}
