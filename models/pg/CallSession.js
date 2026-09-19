import { toCamelCase, mapRows } from "../../utils/rowMapper.js";

export async function create(client, tenantId, data) {
  const result = await client.query(
    `INSERT INTO call_sessions (
        tenant_id, call_sid, from_number, to_number, status, started_at,
        client_ref, legacy_payload
     ) VALUES ($1,$2,$3,$4,'in_progress',$5,$6,$7::jsonb)
     RETURNING id, tenant_id AS "tenantId", call_sid AS "callSid",
               from_number AS "fromNumber", to_number AS "toNumber",
               status, started_at AS "startedAt", ended_at AS "endedAt",
               duration_seconds AS "durationSeconds", client_ref AS "clientRef"`,
    [
      tenantId,
      data.callSid,
      data.fromNumber || null,
      data.toNumber || null,
      data.startedAt || new Date(),
      data.clientRef || null,
      JSON.stringify(data.legacyPayload || {}),
    ]
  );
  return toCamelCase(result.rows[0]);
}

export async function findByCallSid(client, tenantId, callSid) {
  const result = await client.query(
    `SELECT id, tenant_id AS "tenantId", call_sid AS "callSid",
            from_number AS "fromNumber", to_number AS "toNumber",
            status, started_at AS "startedAt", ended_at AS "endedAt",
            duration_seconds AS "durationSeconds", client_ref AS "clientRef"
       FROM call_sessions
      WHERE tenant_id = $1 AND call_sid = $2
      LIMIT 1`,
    [tenantId, callSid]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function listActive(client, tenantId, clientRef) {
  const values = [tenantId];
  let clientClause = "";
  if (clientRef) {
    values.push(clientRef);
    clientClause = ` AND client_ref = $${values.length}`;
  }
  const result = await client.query(
    `SELECT id, tenant_id AS "tenantId", call_sid AS "callSid",
            from_number AS "fromNumber", started_at AS "startedAt",
            client_ref AS "clientRef"
       FROM call_sessions
      WHERE tenant_id = $1
        AND ended_at IS NULL
        AND status = 'in_progress'
        ${clientClause}
      ORDER BY started_at ASC`,
    values
  );
  return mapRows(result.rows);
}

export async function complete(client, tenantId, callSid, { endedAt, durationSeconds }) {
  const result = await client.query(
    `UPDATE call_sessions
        SET ended_at = $3,
            duration_seconds = $4,
            status = 'completed'
      WHERE tenant_id = $1 AND call_sid = $2
      RETURNING id, call_sid AS "callSid", client_ref AS "clientRef",
                started_at AS "startedAt", ended_at AS "endedAt",
                duration_seconds AS "durationSeconds"`,
    [tenantId, callSid, endedAt || new Date(), durationSeconds ?? null]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function completeStale(client, tenantId, clientRef, startedAt) {
  await client.query(
    `UPDATE call_sessions
        SET ended_at = started_at,
            duration_seconds = 0,
            status = 'failed'
      WHERE tenant_id = $1
        AND client_ref = $2
        AND ended_at IS NULL
        AND started_at = $3`,
    [tenantId, clientRef, startedAt]
  );
}

export async function completeAllActive(client, tenantId, clientRef) {
  await client.query(
    `UPDATE call_sessions
        SET ended_at = NOW(),
            duration_seconds = 0,
            status = 'completed'
      WHERE tenant_id = $1
        AND client_ref = $2
        AND ended_at IS NULL`,
    [tenantId, clientRef]
  );
}

export async function listRecent(client, tenantId, { limit = 50 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const result = await client.query(
    `SELECT id, tenant_id AS "tenantId", call_sid AS "callSid",
            from_number AS "fromNumber", to_number AS "toNumber",
            status, started_at AS "startedAt", ended_at AS "endedAt",
            duration_seconds AS "durationSeconds", client_ref AS "clientRef"
       FROM call_sessions
      WHERE tenant_id = $1
      ORDER BY started_at DESC
      LIMIT $2`,
    [tenantId, cap]
  );
  return mapRows(result.rows);
}

const DURATION_SECONDS = `
  GREATEST(
    COALESCE(
      duration_seconds,
      CASE
        WHEN ended_at IS NULL THEN EXTRACT(EPOCH FROM (NOW() - started_at))
        ELSE EXTRACT(EPOCH FROM (ended_at - started_at))
      END
    ),
    0
  )
`;

export async function summarizeUsage(client, tenantId, { since } = {}) {
  const params = [tenantId];
  let sinceClause = "";
  if (since) {
    params.push(since);
    sinceClause = ` AND started_at >= $${params.length}`;
  }
  const result = await client.query(
    `SELECT COALESCE(SUM(${DURATION_SECONDS}), 0)::bigint AS seconds,
            COALESCE(SUM(CEIL(${DURATION_SECONDS} / 60.0)), 0)::int AS "billedMinutes",
            COUNT(*)::int AS "callCount"
       FROM call_sessions
      WHERE tenant_id = $1${sinceClause}`,
    params
  );
  const row = result.rows[0] || {};
  return {
    seconds: Number(row.seconds) || 0,
    billedMinutes: Number(row.billedMinutes) || 0,
    callCount: Number(row.callCount) || 0,
  };
}

export async function listForClient(client, tenantId, clientRef, { limit = 50, offset = 0 } = {}) {
  const result = await client.query(
    `SELECT id, tenant_id AS "tenantId", call_sid AS "callSid",
            from_number AS "fromNumber", started_at AS "startedAt",
            ended_at AS "endedAt", duration_seconds AS "durationSeconds",
            client_ref AS "clientRef"
       FROM call_sessions
      WHERE tenant_id = $1 AND client_ref = $2
      ORDER BY started_at DESC
      LIMIT $3 OFFSET $4`,
    [tenantId, clientRef, limit, offset]
  );
  return mapRows(result.rows);
}
