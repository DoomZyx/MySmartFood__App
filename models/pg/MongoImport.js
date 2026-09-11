import { toCamelCase } from "../../utils/rowMapper.js";

export async function findRef(client, tenantId, collection, mongoId) {
  const result = await client.query(
    `SELECT pg_id AS "pgId" FROM mongo_import_refs
      WHERE tenant_id = $1 AND collection = $2 AND mongo_id = $3`,
    [tenantId, collection, String(mongoId)]
  );
  return result.rows[0]?.pgId || null;
}

export async function saveRef(client, tenantId, collection, mongoId, pgId) {
  await client.query(
    `INSERT INTO mongo_import_refs (tenant_id, collection, mongo_id, pg_id)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_id, collection, mongo_id) DO UPDATE SET pg_id = EXCLUDED.pg_id`,
    [tenantId, collection, String(mongoId), pgId]
  );
}

export async function reject(client, tenantId, { collection, mongoId, reason, payload }) {
  const result = await client.query(
    `INSERT INTO migration_rejections (tenant_id, collection, mongo_id, reason, payload)
     VALUES ($1,$2,$3,$4,$5::jsonb)
     RETURNING id`,
    [tenantId, collection, mongoId ? String(mongoId) : null, reason, JSON.stringify(payload || {})]
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
    `SELECT collection, mongo_id AS "mongoId", reason, payload, created_at AS "createdAt"
       FROM migration_rejections
      WHERE tenant_id = $1
      ORDER BY created_at DESC`,
    [tenantId]
  );
  return result.rows;
}
