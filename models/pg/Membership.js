import { getPool } from "../../database/pool.js";
import { toCamelCase, mapRows } from "../../utils/rowMapper.js";

export async function listByUserId(userId) {
  const result = await getPool().query(
    `SELECT m.id, m.tenant_id AS "tenantId", m.user_id AS "userId", m.role,
            m.phone, m.job_title AS "jobTitle", m.department,
            t.slug, t.name, t.status, t.country_code AS "countryCode"
       FROM tenant_memberships m
       JOIN tenants t ON t.id = m.tenant_id
      WHERE m.user_id = $1
      ORDER BY m.created_at ASC`,
    [userId]
  );
  return mapRows(result.rows);
}

export async function findMembership(userId, tenantId) {
  const result = await getPool().query(
    `SELECT m.id, m.tenant_id AS "tenantId", m.user_id AS "userId", m.role,
            m.phone, m.job_title AS "jobTitle", m.department,
            t.slug, t.name, t.status, t.country_code AS "countryCode"
       FROM tenant_memberships m
       JOIN tenants t ON t.id = m.tenant_id
      WHERE m.user_id = $1 AND m.tenant_id = $2
      LIMIT 1`,
    [userId, tenantId]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function createMembership(client, { tenantId, userId, role }) {
  const db = client || getPool();
  const result = await db.query(
    `INSERT INTO tenant_memberships (tenant_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING id, tenant_id AS "tenantId", user_id AS "userId", role`,
    [tenantId, userId, role]
  );
  return toCamelCase(result.rows[0]);
}

export async function updateRole(userId, tenantId, role) {
  const result = await getPool().query(
    `UPDATE tenant_memberships
        SET role = $3
      WHERE user_id = $1 AND tenant_id = $2
      RETURNING id, tenant_id AS "tenantId", user_id AS "userId", role`,
    [userId, tenantId, role]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function removeMembership(userId, tenantId) {
  const result = await getPool().query(
    `DELETE FROM tenant_memberships
      WHERE user_id = $1 AND tenant_id = $2
      RETURNING id`,
    [userId, tenantId]
  );
  return result.rowCount > 0;
}

export async function countOwners(tenantId) {
  const result = await getPool().query(
    `SELECT COUNT(*)::int AS count
       FROM tenant_memberships
      WHERE tenant_id = $1 AND role = 'owner'`,
    [tenantId]
  );
  return result.rows[0]?.count || 0;
}

export async function updateProfile(userId, tenantId, { phone, jobTitle, department }) {
  const result = await getPool().query(
    `UPDATE tenant_memberships
        SET phone = $3,
            job_title = $4,
            department = $5
      WHERE user_id = $1 AND tenant_id = $2
      RETURNING id, tenant_id AS "tenantId", user_id AS "userId", role,
                phone, job_title AS "jobTitle", department`,
    [
      userId,
      tenantId,
      phone != null ? String(phone).trim() || null : null,
      jobTitle != null ? String(jobTitle).trim() || null : null,
      department != null ? String(department).trim() || null : null,
    ]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}
