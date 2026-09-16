import { toCamelCase, mapRows } from "../../utils/rowMapper.js";

export async function create(client, tenantId, data) {
  const result = await client.query(
    `INSERT INTO failed_extractions (
        tenant_id, call_sid, stream_sid, transcript, error_message, status,
        attempts, error_stack, notes, treated_at, legacy_payload
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
     RETURNING id, tenant_id AS "tenantId", stream_sid AS "streamSid",
               status, attempts, created_at AS "createdAt"`,
    [
      tenantId,
      data.callSid || null,
      data.streamSid || null,
      data.transcript || null,
      data.errorMessage || null,
      data.status || "extraction_echouee",
      data.attempts || 0,
      data.errorStack || null,
      data.notes || null,
      data.treatedAt || null,
      JSON.stringify(data.legacyPayload || {}),
    ]
  );
  return toCamelCase(result.rows[0]);
}

export async function listPending(client, tenantId, { limit = 50, offset = 0 } = {}) {
  const result = await client.query(
    `SELECT id, stream_sid AS "streamSid", transcript, error_message AS "errorMessage",
            status, attempts, created_at AS "createdAt"
       FROM failed_extractions
      WHERE tenant_id = $1
        AND status IN ('extraction_echouee', 'en_attente_traitement')
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
    [tenantId, limit, offset]
  );
  return mapRows(result.rows);
}

export async function markProcessed(client, tenantId, id) {
  const result = await client.query(
    `UPDATE failed_extractions
        SET status = 'traite', treated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, status, treated_at AS "treatedAt"`,
    [tenantId, id]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function countSince(client, tenantId, since) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS total
       FROM failed_extractions
      WHERE tenant_id = $1 AND created_at >= $2`,
    [tenantId, since]
  );
  return result.rows[0]?.total || 0;
}
