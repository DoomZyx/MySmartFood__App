import { toCamelCase, mapRows } from "../../utils/rowMapper.js";

export async function upsertByPhone(client, tenantId, data) {
  const result = await client.query(
    `INSERT INTO clients (
        tenant_id, phone, name, email, first_name, last_name,
        address, company, client_type, notes, legacy_payload
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
     ON CONFLICT (tenant_id, phone) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, clients.name),
        email = COALESCE(EXCLUDED.email, clients.email),
        first_name = COALESCE(EXCLUDED.first_name, clients.first_name),
        last_name = COALESCE(EXCLUDED.last_name, clients.last_name),
        address = COALESCE(EXCLUDED.address, clients.address),
        company = COALESCE(EXCLUDED.company, clients.company),
        client_type = COALESCE(EXCLUDED.client_type, clients.client_type),
        notes = COALESCE(EXCLUDED.notes, clients.notes),
        legacy_payload = clients.legacy_payload || EXCLUDED.legacy_payload
     RETURNING id, phone, name, email, first_name AS "firstName", last_name AS "lastName",
               address, company, client_type AS "clientType", notes, created_at AS "createdAt"`,
    [
      tenantId,
      data.phone,
      data.name || null,
      data.email || null,
      data.firstName || null,
      data.lastName || null,
      data.address || null,
      data.company || null,
      data.clientType || "client",
      data.notes || null,
      JSON.stringify(data.legacyPayload || {}),
    ]
  );
  return toCamelCase(result.rows[0]);
}

export async function list(client, tenantId) {
  const result = await client.query(
    `SELECT id, phone, name, email, first_name AS "firstName", last_name AS "lastName",
            address, company, client_type AS "clientType", notes, created_at AS "createdAt"
       FROM clients WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return mapRows(result.rows);
}

export async function findById(client, tenantId, id) {
  const result = await client.query(
    `SELECT id, phone, name, email, first_name AS "firstName", last_name AS "lastName",
            address, company, client_type AS "clientType", notes
       FROM clients WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function findByPhone(client, tenantId, phone) {
  const result = await client.query(
    `SELECT id, phone, name, email, first_name AS "firstName", last_name AS "lastName"
       FROM clients WHERE tenant_id = $1 AND phone = $2`,
    [tenantId, phone]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}
