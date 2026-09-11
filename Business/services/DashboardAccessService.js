import crypto from "node:crypto";
import * as AccessToken from "../../models/pg/AccessToken.js";
import * as User from "../../models/pg/User.js";
import * as Membership from "../../models/pg/Membership.js";
import * as Subscription from "../../models/pg/Subscription.js";
import { sendDashboardAccessEmail } from "../../utils/emailService.js";
import { siteUrl } from "../../utils/publicUrls.js";
import { AccountAuthError } from "./AccountAuthService.js";
import logger from "../../Services/logging/logger.js";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashAccessToken(raw) {
  return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

export async function issueDashboardAccessToken({ userId, tenantId }) {
  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashAccessToken(raw);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await AccessToken.insert(null, { userId, tenantId, tokenHash, expiresAt });

  const user = await User.findById(userId);
  const accessUrl = `${siteUrl()}/access?token=${encodeURIComponent(raw)}`;
  try {
    await sendDashboardAccessEmail({
      email: user?.email,
      name: user?.name,
      accessUrl,
    });
  } catch (err) {
    logger.error({ err: err.message, userId }, "Envoi e-mail jeton d'accès échoué");
  }

  return { expiresAt };
}

export async function redeemDashboardAccessToken(rawToken) {
  const token = String(rawToken || "").trim();
  if (!token || token.length < 32) {
    throw new AccountAuthError("Jeton invalide", 400);
  }

  const row = await AccessToken.findValidByHash(hashAccessToken(token));
  if (!row) {
    throw new AccountAuthError("Jeton invalide ou expiré", 400);
  }

  const user = await User.findById(row.userId);
  if (!user) {
    throw new AccountAuthError("Jeton invalide ou expiré", 400);
  }

  if (row.tenantId) {
    const subscription = await Subscription.findCurrentByTenant(row.tenantId);
    if (!subscription || !Subscription.isAccessGranted(subscription.status)) {
      throw new AccountAuthError("Aucun abonnement actif", 403);
    }
  }

  await AccessToken.markConsumed(row.id);
  await User.markDashboardUnlocked(user.id);
  await User.touchLastLogin(user.id);
  return User.findById(user.id);
}

export async function resendDashboardAccessToken(userId) {
  const memberships = await Membership.listByUserId(userId);
  for (const membership of memberships) {
    const subscription = await Subscription.findCurrentByTenant(membership.tenantId);
    if (subscription && Subscription.isAccessGranted(subscription.status)) {
      return issueDashboardAccessToken({ userId, tenantId: membership.tenantId });
    }
  }
  throw new AccountAuthError("Aucun abonnement actif", 403);
}
