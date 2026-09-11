import crypto from "node:crypto";
import * as User from "../../models/pg/User.js";
import * as Membership from "../../models/pg/Membership.js";
import * as Subscription from "../../models/pg/Subscription.js";
import * as Plan from "../../models/pg/Plan.js";
import * as EstablishmentProfile from "../../models/pg/EstablishmentProfile.js";
import { getPool } from "../../database/pool.js";
import { websitePlanIdFromSlug } from "../mappers/websitePlan.js";
import { dashboardUrl } from "../../utils/publicUrls.js";

export class AccountAuthError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function register({ email, password, name }) {
  const emailNorm = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    throw new AccountAuthError("Adresse e-mail invalide", 400);
  }
  if (!password || String(password).trim().length < 8) {
    throw new AccountAuthError("Le mot de passe doit contenir au moins 8 caractères", 400);
  }
  const existing = await User.findByEmail(emailNorm);
  if (existing) {
    throw new AccountAuthError("Un compte existe déjà avec cette adresse e-mail", 409);
  }
  const user = await User.create({
    email: emailNorm,
    name: name || null,
    password: password,
    emailVerified: false,
  });
  return user;
}

export async function login({ email, password }) {
  const emailNorm = String(email || "").trim().toLowerCase();
  const user = await User.findByEmail(emailNorm);
  if (!user) {
    throw new AccountAuthError("Identifiants incorrects", 401);
  }
  const valid = await User.verifyPassword(user.id, password);
  if (!valid) {
    throw new AccountAuthError("Identifiants incorrects", 401);
  }
  await User.touchLastLogin(user.id);
  return user;
}

/**
 * Google : l'e-mail doit être vérifié chez Google.
 * Si le compte existe déjà avec cette adresse et n'a pas d'autre google_id, on le lie.
 */
export async function loginWithGoogleProfile(profile) {
  const email = profile.email?.trim().toLowerCase();
  if (!email) {
    throw new AccountAuthError("Email non fourni par Google", 400);
  }
  if (profile.emailVerified !== true) {
    throw new AccountAuthError("L'adresse Google n'est pas vérifiée", 403);
  }

  const byGoogle = await User.findByGoogleId(profile.googleId);
  if (byGoogle) {
    await User.touchLastLogin(byGoogle.id);
    return { user: byGoogle, linkRequired: false };
  }

  const byEmail = await User.findByEmail(email);
  if (byEmail) {
    if (byEmail.googleId && byEmail.googleId !== profile.googleId) {
      throw new AccountAuthError("Ce compte est déjà lié à un autre identifiant Google", 409);
    }
    const linked = await User.linkGoogle(byEmail.id, {
      googleId: profile.googleId,
      avatarUrl: profile.avatarUrl,
      name: profile.name,
    });
    await User.touchLastLogin(linked.id);
    return { user: linked, linkRequired: false };
  }

  const created = await User.create({
    email,
    name: profile.name || null,
    googleId: profile.googleId,
    avatarUrl: profile.avatarUrl || null,
    emailVerified: true,
  });
  await User.touchLastLogin(created.id);
  return { user: created, linkRequired: false };
}

export async function confirmGoogleLink({ userId, token }) {
  const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
  const result = await getPool().query(
    `SELECT id, google_id AS "googleId"
       FROM oauth_link_challenges
      WHERE user_id = $1 AND token_hash = $2 AND consumed_at IS NULL AND expires_at > NOW()
      LIMIT 1`,
    [userId, tokenHash]
  );
  const challenge = result.rows[0];
  if (!challenge) {
    throw new AccountAuthError("Lien de confirmation invalide ou expiré", 400);
  }
  await getPool().query(
    `UPDATE oauth_link_challenges SET consumed_at = NOW() WHERE id = $1`,
    [challenge.id]
  );
  const user = await User.linkGoogle(userId, { googleId: challenge.googleId });
  return user;
}

export async function sessionPayload(user) {
  const memberships = await Membership.listByUserId(user.id);
  const tenants = memberships.map((item) => ({
    id: item.tenantId,
    slug: item.slug,
    name: item.name,
    role: item.role,
    status: item.status,
  }));
  const first = tenants[0] || null;
  let planSlug = null;
  let planId = null;
  let twilioDocsSubmittedAt = null;
  let subscriptionStatus = null;
  if (first) {
    const subscription = await Subscription.findCurrentByTenant(first.id);
    subscriptionStatus = subscription?.status || null;
    if (subscription?.planId) {
      const plan = await Plan.findById(subscription.planId);
      planSlug = plan?.slug || null;
      planId = websitePlanIdFromSlug(planSlug);
    }
    const profile = await EstablishmentProfile.findByTenantId(first.id);
    twilioDocsSubmittedAt = profile?.documentsSubmittedAt || null;
  }
  const hasActiveSubscription = Boolean(
    subscriptionStatus && Subscription.isAccessGranted(subscriptionStatus)
  );
  const accessUnlocked = Boolean(user.dashboardUnlockedAt);
  const publicUser = User.publicUser(user);
  return {
    user: {
      ...publicUser,
      avatar: publicUser.avatarUrl,
      planId,
      planSlug,
      hasActiveSubscription,
      accessUnlocked,
      smartcrmInstanceId: first?.id || null,
      twilioDocsSubmittedAt,
      role: user.isPlatformAdmin || first ? "admin" : "user",
      appRole: first ? "admin" : "user",
      dashboardUrl: dashboardUrl(),
    },
    tenants,
  };
}
