import { getPool } from "../../database/pool.js";
import { toCamelCase } from "../../utils/rowMapper.js";

export async function findById(id) {
  const result = await getPool().query(
    `SELECT id, slug, name, status, country_code AS "countryCode",
            owner_user_id AS "ownerUserId", activated_at AS "activatedAt",
            created_at AS "createdAt"
       FROM tenants WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function findBySlug(slug) {
  const result = await getPool().query(
    `SELECT id, slug, name, status, country_code AS "countryCode"
       FROM tenants WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function createTenant(client, { slug, name, ownerUserId, countryCode = "FR", status = "pending_payment" }) {
  const db = client || getPool();
  const result = await db.query(
    `INSERT INTO tenants (slug, name, owner_user_id, country_code, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, slug, name, status, country_code AS "countryCode", owner_user_id AS "ownerUserId"`,
    [slug, name, ownerUserId, countryCode, status]
  );
  return toCamelCase(result.rows[0]);
}

export async function updateStatus(client, tenantId, status, extra = {}) {
  const db = client || getPool();
  const activatedAt = status === "active" ? new Date() : extra.activatedAt || null;
  await db.query(
    `UPDATE tenants
        SET status = $2,
            activated_at = COALESCE($3, activated_at)
      WHERE id = $1`,
    [tenantId, status, activatedAt]
  );
}

const PLATFORM_TENANT_SELECT = `
  t.id, t.slug, t.name, t.status, t.country_code AS "countryCode",
  t.owner_user_id AS "ownerUserId", t.created_at AS "createdAt",
  t.activated_at AS "activatedAt",
  u.email AS "ownerEmail", u.name AS "ownerName",
  p.slug AS "planSlug", p.name AS "planName",
  s.status AS "subscriptionStatus",
  j.state AS "provisioningState", j.last_error AS "provisioningError",
  b.phone_number AS "phoneNumber", b.phone_number_sid AS "phoneNumberSid",
  b.status AS "bundleStatus",
  ep.phone AS "restaurantPhone", ep.business_name AS "businessName",
  ep.documents_submitted_at AS "documentsSubmittedAt"
`;

const PLATFORM_TENANT_JOINS = `
  FROM tenants t
  JOIN users u ON u.id = t.owner_user_id
  LEFT JOIN LATERAL (
    SELECT plan_id, status
      FROM subscriptions
     WHERE tenant_id = t.id
     ORDER BY created_at DESC
     LIMIT 1
  ) s ON TRUE
  LEFT JOIN plans p ON p.id = s.plan_id
  LEFT JOIN provisioning_jobs j ON j.tenant_id = t.id
  LEFT JOIN LATERAL (
    SELECT phone_number, phone_number_sid, status
      FROM twilio_bundles
     WHERE tenant_id = t.id
     ORDER BY updated_at DESC
     LIMIT 1
  ) b ON TRUE
  LEFT JOIN establishment_profiles ep ON ep.tenant_id = t.id
`;

export async function findForPlatform(tenantId) {
  const result = await getPool().query(
    `SELECT ${PLATFORM_TENANT_SELECT}
     ${PLATFORM_TENANT_JOINS}
     WHERE t.id = $1 AND t.status <> 'closed'`,
    [tenantId]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function listForPlatform({ status, limit = 100 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const result = await getPool().query(
    `SELECT ${PLATFORM_TENANT_SELECT}
     ${PLATFORM_TENANT_JOINS}
      WHERE t.status <> 'closed'
        AND ($1::text IS NULL OR t.status = $1)
      ORDER BY t.created_at DESC
      LIMIT $2`,
    [status || null, cap]
  );
  return result.rows.map((row) => toCamelCase(row));
}

export function slugFromName(name, suffix) {
  const base = String(name || "etablissement")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "etablissement";
  return `${base}-${suffix}`;
}
