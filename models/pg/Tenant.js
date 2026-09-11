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
