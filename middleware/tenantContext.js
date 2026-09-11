import * as Membership from "../models/pg/Membership.js";
import * as Subscription from "../models/pg/Subscription.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Résout le tenant depuis l'appartenance serveur.
 * Un en-tête X-Tenant-Id n'est qu'un sélecteur : il est ignoré s'il n'y a pas d'appartenance.
 */
export async function resolveTenant(request, reply) {
  if (!request.user) {
    return reply.code(401).send({ error: "Non authentifié" });
  }

  const memberships = await Membership.listByUserId(request.user.id);
  if (memberships.length === 0) {
    return reply.code(403).send({ error: "Aucun établissement associé à ce compte" });
  }

  const selector = typeof request.headers["x-tenant-id"] === "string"
    ? request.headers["x-tenant-id"].trim()
    : "";

  let membership = null;
  if (selector) {
    if (!UUID_PATTERN.test(selector)) {
      return reply.code(400).send({ error: "Identifiant d'établissement invalide" });
    }
    membership = memberships.find((item) => item.tenantId === selector) || null;
    if (!membership) {
      return reply.code(403).send({ error: "Accès refusé à cet établissement" });
    }
  } else if (memberships.length === 1) {
    membership = memberships[0];
  } else {
    return reply.code(400).send({
      error: "Plusieurs établissements : envoyer l'en-tête X-Tenant-Id",
      tenants: memberships.map((item) => ({
        id: item.tenantId,
        slug: item.slug,
        name: item.name,
        role: item.role,
        status: item.status,
      })),
    });
  }

  request.tenant = {
    id: membership.tenantId,
    slug: membership.slug,
    name: membership.name,
    status: membership.status,
    role: membership.role,
  };
  request.instanceId = membership.tenantId;
}

export function requireRole(...roles) {
  return async function requireRoleHandler(request, reply) {
    if (!request.tenant) {
      return reply.code(403).send({ error: "Contexte établissement manquant" });
    }
    if (!roles.includes(request.tenant.role)) {
      return reply.code(403).send({ error: "Droits insuffisants" });
    }
  };
}

export async function requireActiveSubscription(request, reply) {
  if (!request.tenant) {
    return reply.code(403).send({ error: "Contexte établissement manquant" });
  }
  const subscription = await Subscription.findCurrentByTenant(request.tenant.id);
  if (!subscription || !Subscription.isAccessGranted(subscription.status)) {
    return reply.code(402).send({ error: "Abonnement inactif" });
  }
  request.subscription = subscription;
}
