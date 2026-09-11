import * as Plan from "../../models/pg/Plan.js";
import * as Tenant from "../../models/pg/Tenant.js";
import * as Membership from "../../models/pg/Membership.js";
import * as Subscription from "../../models/pg/Subscription.js";
import * as User from "../../models/pg/User.js";
import { createProvisioningJob } from "../../models/pg/ProvisioningJob.js";
import { withTenant, withTransaction } from "../../database/transaction.js";

const COUNTRY_CODES = {
  France: "FR",
  Belgique: "BE",
  Luxembourg: "LU",
};

export function countryCodeFromLabel(country) {
  return COUNTRY_CODES[String(country || "").trim()] || "FR";
}

export async function firstTenantId(userId) {
  const memberships = await Membership.listByUserId(userId);
  return memberships[0]?.tenantId || null;
}

/**
 * Crée l'établissement + l'abonnement beta s'il n'existe pas encore.
 * Permet de saisir le profil restaurant sans passer par Stripe.
 */
export async function ensureBetaTenant(user, { name, countryCode } = {}) {
  const existingId = await firstTenantId(user.id);
  if (existingId) return existingId;

  const plan = (await Plan.findBySlug("beta")) || (await Plan.findBySlug("developpeur"));
  if (!plan) {
    const err = new Error("Plan beta indisponible. Lancer les migrations.");
    err.statusCode = 500;
    throw err;
  }

  let tenantId = null;
  await withTransaction(async (client) => {
    const tenant = await Tenant.createTenant(client, {
      slug: Tenant.slugFromName(name || user.email, String(user.id).slice(0, 8)),
      name: name || "Établissement",
      ownerUserId: user.id,
      countryCode: countryCode || "FR",
      status: "pending_compliance",
    });
    tenantId = tenant.id;
    await Membership.createMembership(client, {
      tenantId,
      userId: user.id,
      role: "owner",
    });
    await createProvisioningJob(client, tenantId);
    const periodEnd = new Date();
    periodEnd.setFullYear(periodEnd.getFullYear() + 2);
    await Subscription.createManual(client, {
      tenantId,
      planId: plan.id,
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
    });
  });

  await withTenant(tenantId, (tenantClient) =>
    tenantClient.query(
      `INSERT INTO tenant_settings (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [tenantId]
    )
  );
  await User.markDashboardUnlocked(user.id);
  return tenantId;
}
