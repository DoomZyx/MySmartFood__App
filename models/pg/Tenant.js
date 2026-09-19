import { getPool } from "../../database/pool.js";
import { toCamelCase } from "../../utils/rowMapper.js";

export async function findById(id) {
  const result = await getPool().query(
    `SELECT id, slug, name, status, country_code AS "countryCode",
            owner_user_id AS "ownerUserId", onboarded_by AS "onboardedBy",
            openai_api_key AS "openaiApiKey", openai_model AS "openaiModel",
            activated_at AS "activatedAt", created_at AS "createdAt"
       FROM tenants WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function findBySlug(slug) {
  const result = await getPool().query(
    `SELECT id, slug, name, status, country_code AS "countryCode",
            onboarded_by AS "onboardedBy"
       FROM tenants WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function createTenant(client, {
  slug,
  name,
  ownerUserId,
  countryCode = "FR",
  status = "pending_payment",
  onboardedBy = "self",
}) {
  const db = client || getPool();
  const result = await db.query(
    `INSERT INTO tenants (
        slug, name, owner_user_id, country_code, status, onboarded_by, activated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $5 = 'active' THEN NOW() ELSE NULL END)
     RETURNING id, slug, name, status, country_code AS "countryCode",
               owner_user_id AS "ownerUserId", onboarded_by AS "onboardedBy"`,
    [slug, name, ownerUserId, countryCode, status, onboardedBy]
  );
  return toCamelCase(result.rows[0]);
}

export async function updateDetails(client, tenantId, { name, countryCode } = {}) {
  const db = client || getPool();
  const result = await db.query(
    `UPDATE tenants
        SET name = COALESCE($2, name),
            country_code = COALESCE($3, country_code)
      WHERE id = $1 AND status <> 'closed'
      RETURNING id`,
    [tenantId, name || null, countryCode || null]
  );
  return result.rowCount > 0;
}

export async function updateOpenAi(client, tenantId, { apiKey, model } = {}) {
  const db = client || getPool();
  const sets = [];
  const values = [tenantId];
  if (apiKey !== undefined) {
    values.push(apiKey);
    sets.push(`openai_api_key = $${values.length}`);
  }
  if (model !== undefined) {
    values.push(model);
    sets.push(`openai_model = $${values.length}`);
  }
  if (sets.length === 0) return false;
  const result = await db.query(
    `UPDATE tenants SET ${sets.join(", ")} WHERE id = $1 AND status <> 'closed' RETURNING id`,
    values
  );
  return result.rowCount > 0;
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
  t.owner_user_id AS "ownerUserId", t.onboarded_by AS "onboardedBy",
  t.created_at AS "createdAt", t.activated_at AS "activatedAt",
  (t.openai_api_key IS NOT NULL AND btrim(t.openai_api_key) <> '') AS "openaiKeyConfigured",
  t.openai_model AS "openaiModel",
  u.email AS "ownerEmail", u.name AS "ownerName",
  p.slug AS "planSlug", p.name AS "planName",
  s.status AS "subscriptionStatus",
  s.stripe_customer_id AS "stripeCustomerId",
  s.stripe_subscription_id AS "stripeSubscriptionId",
  s.current_period_end AS "subscriptionPeriodEnd",
  s.cancel_at_period_end AS "cancelAtPeriodEnd",
  t.internal_note AS "internalNote",
  j.state AS "provisioningState", j.last_error AS "provisioningError",
  b.phone_number AS "phoneNumber", b.phone_number_sid AS "phoneNumberSid",
  b.status AS "bundleStatus",
  ep.phone AS "restaurantPhone", ep.business_name AS "businessName",
  ep.address_line AS "addressLine", ep.postal_code AS "postalCode",
  ep.city, ep.country AS "profileCountry", ep.email AS "restaurantEmail",
  ep.seat_count AS "seatCount", ep.cuisine_type AS "cuisineType",
  ep.phone_number_usage AS "phoneNumberUsage",
  ep.siret, ep.siren,
  ep.documents_submitted_at AS "documentsSubmittedAt",
  docs.documents
`;

const PLATFORM_TENANT_JOINS = `
  FROM tenants t
  JOIN users u ON u.id = t.owner_user_id
  LEFT JOIN LATERAL (
    SELECT plan_id, status, stripe_customer_id, stripe_subscription_id,
           current_period_end, cancel_at_period_end
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
     ORDER BY (phone_number IS NOT NULL) DESC, updated_at DESC
     LIMIT 1
  ) b ON TRUE
  LEFT JOIN establishment_profiles ep ON ep.tenant_id = t.id
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'kind', d.kind,
          'mimeType', d.mime_type,
          'byteSize', d.byte_size,
          'sha256', d.content_sha256,
          'uploadedAt', d.created_at
        )
        ORDER BY d.kind
      ),
      '[]'::json
    ) AS documents
      FROM onboarding_documents d
     WHERE d.tenant_id = t.id AND d.purged_at IS NULL
  ) docs ON TRUE
`;

export async function findForPlatform(tenantId, { includeClosed = false } = {}) {
  const result = await getPool().query(
    `SELECT ${PLATFORM_TENANT_SELECT}
     ${PLATFORM_TENANT_JOINS}
     WHERE t.id = $1
       AND ($2::boolean OR t.status <> 'closed')`,
    [tenantId, Boolean(includeClosed)]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function listPendingForPlatform({ limit = 100 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const result = await getPool().query(
    `SELECT ${PLATFORM_TENANT_SELECT}
     ${PLATFORM_TENANT_JOINS}
      WHERE t.status <> 'suspended'
        AND (
          t.status IN ('pending_compliance', 'pending_payment')
          OR (
            ep.documents_submitted_at IS NOT NULL
            AND COALESCE(j.state, 'bundle_submitted') NOT IN (
              'completed',
              'bundle_approved',
              'bundle_rejected'
            )
          )
        )
      ORDER BY COALESCE(ep.documents_submitted_at, t.created_at) DESC
      LIMIT $1`,
    [cap]
  );
  return result.rows.map((row) => toCamelCase(row));
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

export async function listClosedForPlatform({ limit = 100 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const result = await getPool().query(
    `SELECT ${PLATFORM_TENANT_SELECT}
     ${PLATFORM_TENANT_JOINS}
      WHERE t.status = 'closed'
      ORDER BY t.created_at DESC
      LIMIT $1`,
    [cap]
  );
  return result.rows.map((row) => toCamelCase(row));
}

export async function updateInternalNote(tenantId, note) {
  const result = await getPool().query(
    `UPDATE tenants
        SET internal_note = $2
      WHERE id = $1
      RETURNING id, internal_note AS "internalNote"`,
    [tenantId, note == null ? null : String(note).trim().slice(0, 2000) || null]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function listFleetForPlatform({ limit = 100 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const result = await getPool().query(
    `SELECT ${PLATFORM_TENANT_SELECT}
     ${PLATFORM_TENANT_JOINS}
      WHERE t.status IN ('active', 'suspended')
      ORDER BY t.status ASC, COALESCE(t.activated_at, t.created_at) DESC
      LIMIT $1`,
    [cap]
  );
  return result.rows.map((row) => toCamelCase(row));
}

export async function remove(id, client) {
  const db = client || getPool();
  const result = await db.query(`DELETE FROM tenants WHERE id = $1 RETURNING id`, [id]);
  return result.rowCount > 0;
}

export async function listOwnedByUser(userId) {
  const result = await getPool().query(
    `SELECT t.id, t.name, t.status, ep.business_name AS "businessName"
       FROM tenants t
       LEFT JOIN establishment_profiles ep ON ep.tenant_id = t.id
      WHERE t.owner_user_id = $1
      ORDER BY t.created_at DESC`,
    [userId]
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
