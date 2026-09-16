import { toCamelCase } from "../../utils/rowMapper.js";

export async function findRef(client, tenantId, collection, sourceId) {
  const result = await client.query(
    `SELECT pg_id AS "pgId" FROM legacy_id_refs
      WHERE tenant_id = $1 AND collection = $2 AND source_id = $3`,
    [tenantId, collection, String(sourceId)]
  );
  return result.rows[0]?.pgId || null;
}

export async function saveRef(client, tenantId, collection, sourceId, pgId) {
  await client.query(
    `INSERT INTO legacy_id_refs (tenant_id, collection, source_id, pg_id)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_id, collection, source_id) DO UPDATE SET pg_id = EXCLUDED.pg_id`,
    [tenantId, collection, String(sourceId), pgId]
  );
}

export async function reject(client, tenantId, { collection, sourceId, reason, payload }) {
  const result = await client.query(
    `INSERT INTO migration_rejections (tenant_id, collection, source_id, reason, payload)
     VALUES ($1,$2,$3,$4,$5::jsonb)
     RETURNING id`,
    [tenantId, collection, sourceId ? String(sourceId) : null, reason, JSON.stringify(payload || {})]
  );
  return toCamelCase(result.rows[0]);
}

export async function countByCollection(client, tenantId, table) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count FROM ${table} WHERE tenant_id = $1`,
    [tenantId]
  );
  return result.rows[0].count;
}

export async function listRejections(client, tenantId) {
  const result = await client.query(
    `SELECT collection, source_id AS "sourceId", reason, payload, created_at AS "createdAt"
       FROM migration_rejections
      WHERE tenant_id = $1
      ORDER BY created_at DESC`,
    [tenantId]
  );
  return result.rows;
}
