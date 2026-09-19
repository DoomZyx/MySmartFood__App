import * as User from "../../models/pg/User.js";
import * as Membership from "../../models/pg/Membership.js";
import { hasPlatformCapability } from "./PlatformAccess.js";
import { recordPlatformAudit } from "./PlatformAuditService.js";
import {
  readImpersonateToken,
  setImpersonateCookie,
  clearImpersonateCookie,
} from "../../middleware/sessionAuth.js";

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

function serializeImpersonation(actor, target, membership, decoded) {
  return {
    actorId: actor.id,
    actorEmail: actor.email,
    targetUserId: target.id,
    tenantId: membership.tenantId,
    expiresAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
    target,
    membership,
  };
}

export async function startImpersonation(reply, actor, { userId, tenantId } = {}) {
  if (!hasPlatformCapability(actor, "impersonate")) {
    httpError("Droits insuffisants", 403);
  }
  if (!userId) httpError("Utilisateur requis", 400);
  if (userId === actor.id) httpError("Vous ne pouvez pas impersonner votre propre compte", 400);

  const target = await User.findById(userId);
  if (!target) httpError("Utilisateur introuvable", 404);
  if (target.isPlatformAdmin) {
    httpError("Impossible d'ouvrir une session client sur un compte back-office", 403);
  }

  const memberships = await Membership.listByUserId(target.id);
  const usable = memberships.filter((item) => item.status !== "closed");
  let membership = null;
  if (tenantId) {
    membership = usable.find((item) => item.tenantId === tenantId) || null;
    if (!membership) {
      httpError("Cet utilisateur n'a pas accès à cet établissement", 403);
    }
  } else if (usable.length === 1) {
    membership = usable[0];
  } else if (usable.length === 0) {
    httpError("Aucun établissement ouvert pour ce compte", 400);
  } else {
    httpError("Plusieurs établissements : préciser tenantId", 400);
  }

  setImpersonateCookie(reply, {
    actorId: actor.id,
    targetUserId: target.id,
    tenantId: membership.tenantId,
    sessionVersion: Number(actor.sessionVersion || 1),
  });
  await recordPlatformAudit({
    actorId: actor.id,
    action: "impersonate.start",
    targetType: "user",
    targetId: target.id,
    metadata: { tenantId: membership.tenantId },
  });
  return {
    impersonation: {
      actorId: actor.id,
      actorEmail: actor.email,
      targetUserId: target.id,
      tenantId: membership.tenantId,
    },
  };
}

export async function stopImpersonation(reply, actor, request) {
  const decoded = readImpersonateToken(request);
  clearImpersonateCookie(reply);
  if (actor && decoded?.targetUserId) {
    await recordPlatformAudit({
      actorId: actor.id,
      action: "impersonate.stop",
      targetType: "user",
      targetId: decoded.targetUserId,
      metadata: { tenantId: decoded.tenantId || null },
    });
  }
}

export async function loadImpersonation(request) {
  if (request.impersonation !== undefined) return request.impersonation;
  const decoded = readImpersonateToken(request);
  if (!decoded || decoded.scope !== "impersonate") {
    request.impersonation = null;
    return null;
  }
  const actor = request.user;
  if (!actor || decoded.actorId !== actor.id) {
    request.impersonation = null;
    return null;
  }
  if (Number(decoded.sessionVersion || 1) !== Number(actor.sessionVersion || 1)) {
    request.impersonation = null;
    return null;
  }
  if (!hasPlatformCapability(actor, "impersonate")) {
    request.impersonation = null;
    return null;
  }
  const target = await User.findById(decoded.targetUserId);
  if (!target || target.isPlatformAdmin) {
    request.impersonation = null;
    return null;
  }
  const membership = await Membership.findMembership(target.id, decoded.tenantId);
  if (!membership || membership.status === "closed") {
    request.impersonation = null;
    return null;
  }
  request.impersonation = serializeImpersonation(actor, target, membership, decoded);
  return request.impersonation;
}
