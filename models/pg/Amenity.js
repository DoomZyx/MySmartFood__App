import { toCamelCase, mapRows } from "../../utils/rowMapper.js";

export async function listCatalog(client) {
  const result = await client.query(`SELECT slug, label FROM amenities ORDER BY slug`);
  return mapRows(result.rows);
}

export async function listForTenant(client, tenantId) {
  const result = await client.query(
    `SELECT a.slug, a.label,
            COALESCE(t.status, 'unknown') AS status,
            t.quantity, t.details
       FROM amenities a
       LEFT JOIN tenant_amenities t
         ON t.amenity_slug = a.slug AND t.tenant_id = $1
      ORDER BY a.slug`,
    [tenantId]
  );
  return mapRows(result.rows);
}

export async function ensureDefaults(client, tenantId) {
  await client.query(
    `INSERT INTO tenant_amenities (tenant_id, amenity_slug, status)
     SELECT $1, slug, 'unknown' FROM amenities
     ON CONFLICT (tenant_id, amenity_slug) DO NOTHING`,
    [tenantId]
  );
}

export async function upsert(client, tenantId, { slug, status, quantity, details }) {
  const result = await client.query(
    `INSERT INTO tenant_amenities (tenant_id, amenity_slug, status, quantity, details)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (tenant_id, amenity_slug) DO UPDATE SET
        status = EXCLUDED.status,
        quantity = EXCLUDED.quantity,
        details = EXCLUDED.details
     RETURNING amenity_slug AS slug, status, quantity, details`,
    [tenantId, slug, status || "unknown", quantity ?? null, details || null]
  );
  return toCamelCase(result.rows[0]);
}
