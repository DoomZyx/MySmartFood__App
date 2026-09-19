import * as User from "../../models/pg/User.js";
import * as Tenant from "../../models/pg/Tenant.js";
import * as TwilioBundle from "../../models/pg/TwilioBundle.js";
import * as TenantSettings from "../../models/pg/TenantSettings.js";
import { recordPlatformAudit } from "./PlatformAuditService.js";

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || null,
    emailVerified: Boolean(user.emailVerified),
    hasGoogleId: Boolean(user.hasGoogleId),
    isPlatformAdmin: Boolean(user.isPlatformAdmin),
    isPlatformOwner: Boolean(user.isPlatformOwner),
    lastLoginAt: user.lastLoginAt || null,
    dashboardUnlockedAt: user.dashboardUnlockedAt || null,
    createdAt: user.createdAt || null,
    tenants: (user.tenants || []).map((tenant) => ({
      id: tenant.id,
      name: tenant.name || null,
      slug: tenant.slug || null,
      status: tenant.status || null,
      role: tenant.role || null,
      phone: tenant.phone || null,
      jobTitle: tenant.jobTitle || null,
      department: tenant.department || null,
      businessName: tenant.businessName || null,
      restaurantPhone: tenant.restaurantPhone || null,
      restaurantEmail: tenant.restaurantEmail || null,
      addressLine: tenant.addressLine || null,
      postalCode: tenant.postalCode || null,
      city: tenant.city || null,
      siret: tenant.siret || null,
      inboundPhone: tenant.inboundPhone || null,
      planSlug: tenant.planSlug || null,
      planName: tenant.planName || null,
      subscriptionStatus: tenant.subscriptionStatus || null,
      stripeCustomerId: tenant.stripeCustomerId || null,
      stripeSubscriptionId: tenant.stripeSubscriptionId || null,
      onboardedBy: tenant.onboardedBy || null,
      hasStripeCustomer: Boolean(tenant.stripeCustomerId || tenant.stripeSubscriptionId),
      isManualGrant: Boolean(
        tenant.onboardedBy === "platform" && !tenant.stripeSubscriptionId
      ),
      billingOk: ["active", "trialing"].includes(tenant.subscriptionStatus),
      billingUnpaid: ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(
        tenant.subscriptionStatus
      ),
      billingCanceled: tenant.subscriptionStatus === "canceled",
      isOwner: Boolean(
        tenant.ownerUserId && String(tenant.ownerUserId) === String(user.id)
      ),
    })),
  };
}

function assertCanEdit(actor, target) {
  if (target.isPlatformOwner && !actor?.isPlatformOwner) {
    httpError("Le compte propriétaire se gère dans Équipe", 403);
  }
  if (target.isPlatformAdmin && !actor?.isPlatformOwner) {
    httpError("Les comptes back-office se gèrent dans Équipe", 403);
  }
}

export async function listPlatformUsers({ search, limit, offset } = {}) {
  const result = await User.listForPlatform({ search, limit, offset });
  return {
    total: result.total,
    users: result.users.map(serializeUser),
  };
}

export async function getPlatformUser(userId) {
  const user = await User.findForPlatform(userId);
  if (!user) httpError("Utilisateur introuvable", 404);
  return serializeUser(user);
}

export async function updatePlatformUser(actor, userId, body = {}) {
  const target = await User.findById(userId);
  if (!target) httpError("Utilisateur introuvable", 404);
  assertCanEdit(actor, target);

  const nextName = body.name !== undefined ? String(body.name || "").trim().slice(0, 120) : undefined;
  const nextEmail = body.email !== undefined ? String(body.email || "").trim().toLowerCase() : undefined;
  const nextPassword = String(body.password || "").trim();
  const hasAccount =
    nextName !== undefined || nextEmail !== undefined || Boolean(nextPassword);
  const hasFlags = body.emailVerified !== undefined || body.unlockDashboard === true;
  if (!hasAccount && !hasFlags) {
    httpError("Aucun champ à modifier", 400);
  }
  if (nextEmail !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    httpError("Adresse e-mail invalide", 400);
  }

  if (nextName !== undefined || nextEmail !== undefined) {
    try {
      await User.updateAccount(userId, {
        name: nextName,
        email: nextEmail,
      });
    } catch (error) {
      if (/déjà utilisé/i.test(error.message)) httpError(error.message, 409);
      if (/invalide/i.test(error.message)) httpError(error.message, 400);
      throw error;
    }
  }
  if (nextPassword) {
    if (nextPassword.length < 8) {
      httpError("Le mot de passe doit contenir au moins 8 caractères", 400);
    }
    await User.setPassword(userId, nextPassword);
  }
  if (body.emailVerified !== undefined) {
    await User.setEmailVerified(userId, body.emailVerified);
  }
  if (body.unlockDashboard === true) {
    await User.markDashboardUnlocked(userId);
  }

  await recordPlatformAudit({
    actorId: actor?.id || null,
    action: body.unlockDashboard === true
      ? "user.unlock_dashboard"
      : nextPassword
        ? "user.password"
        : "user.update",
    targetType: "user",
    targetId: userId,
    metadata: {
      email: nextEmail !== undefined,
      password: Boolean(nextPassword),
      emailVerified: body.emailVerified !== undefined,
      unlockDashboard: body.unlockDashboard === true,
    },
  });

  return serializeUser(await User.findForPlatform(userId));
}

export async function deletePlatformUser(actor, userId) {
  const target = await User.findById(userId);
  if (!target) httpError("Utilisateur introuvable", 404);
  if (actor?.id && String(actor.id) === String(target.id)) {
    httpError("Vous ne pouvez pas supprimer votre propre compte", 400);
  }
  if (target.isPlatformOwner) {
    httpError("Le propriétaire de la plateforme ne peut pas être supprimé", 403);
  }
  assertCanEdit(actor, target);

  const owned = await Tenant.listOwnedByUser(userId);
  const tenantIds = [];
  for (const tenant of owned) {
    await TwilioBundle.releaseNumber(tenant.id);
    await TenantSettings.setPhoneLineEnabled(null, tenant.id, false);
    const removedTenant = await Tenant.remove(tenant.id);
    if (removedTenant) tenantIds.push(tenant.id);
  }

  const deleted = await User.remove(userId);
  if (!deleted) httpError("Utilisateur introuvable", 404);

  await recordPlatformAudit({
    actorId: actor?.id || null,
    action: "user.delete",
    targetType: "user",
    targetId: userId,
    metadata: { email: target.email, tenantIds },
  });

  return { deleted: true, id: userId, tenantIds };
}
