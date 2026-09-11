import { requireAuth } from "./sessionAuth.js";
import { requireActiveSubscription, resolveTenant } from "./tenantContext.js";
import { timingSafeEqualString } from "../utils/timingSafe.js";
import * as Tenant from "../models/pg/Tenant.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cookie + appartenance, ou secret interne pour les tools vocaux.
 */
export async function requireTenantAccess(request, reply) {
  const expected =
    process.env.SMARTCRM_INTERNAL_SECRET ||
    process.env.WEBSITE_INTERNAL_SECRET ||
    process.env.X_API_KEY;
  const provided =
    request.headers["x-internal-secret"] || request.headers["x-api-key"];

  if (expected && provided && timingSafeEqualString(expected, provided)) {
    const selector =
      (typeof request.headers["x-tenant-id"] === "string" && request.headers["x-tenant-id"].trim()) ||
      (typeof request.instanceId === "string" ? request.instanceId : "") ||
      String(process.env.INSTANCE_ID || "").trim();
    // Clé interne + inst_default : on laisse la session cookie résoudre le tenant.
    if (!UUID_PATTERN.test(selector)) {
      await requireAuth(request, reply);
      if (reply.sent) return;
      await resolveTenant(request, reply);
      if (reply.sent) return;
      await requireActiveSubscription(request, reply);
      return;
    }
    const tenant = await Tenant.findById(selector);
    if (!tenant) {
      return reply.code(403).send({ error: "Établissement inconnu" });
    }
    request.tenant = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      role: "system",
    };
    request.instanceId = tenant.id;
    request.internalCall = true;
    return;
  }

  await requireAuth(request, reply);
  if (reply.sent) return;
  await resolveTenant(request, reply);
  if (reply.sent) return;
  await requireActiveSubscription(request, reply);
}

export async function requireTenantStaffAdmin(request, reply) {
  await requireAuth(request, reply);
  if (reply.sent) return;
  await resolveTenant(request, reply);
  if (reply.sent) return;
  if (request.user.isPlatformAdmin) return;
  await requireActiveSubscription(request, reply);
  if (reply.sent) return;
  if (!["owner", "admin"].includes(request.tenant?.role)) {
    return reply.code(403).send({ error: "Accès refusé" });
  }
}
