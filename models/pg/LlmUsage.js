import { toCamelCase, mapRows } from "../../utils/rowMapper.js";

export async function insert(client, tenantId, data) {
  const inputTokens = Math.max(0, Math.floor(Number(data.inputTokens) || 0));
  const outputTokens = Math.max(0, Math.floor(Number(data.outputTokens) || 0));
  const totalTokens =
    Math.max(0, Math.floor(Number(data.totalTokens) || 0)) ||
    inputTokens + outputTokens;
  const latency =
    data.latencyMs == null ? null : Math.max(0, Math.floor(Number(data.latencyMs)));

  const result = await client.query(
    `INSERT INTO llm_usage_events (
        tenant_id, source, provider, model,
        input_tokens, output_tokens, total_tokens, latency_ms
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, tenant_id AS "tenantId", source, provider, model,
               input_tokens AS "inputTokens", output_tokens AS "outputTokens",
               total_tokens AS "totalTokens", latency_ms AS "latencyMs",
               created_at AS "createdAt"`,
    [
      tenantId,
      data.source,
      data.provider,
      data.model || null,
      inputTokens,
      outputTokens,
      totalTokens,
      Number.isFinite(latency) ? latency : null,
    ]
  );
  return toCamelCase(result.rows[0]);
}

export async function listRecent(client, tenantId, limit = 50) {
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 50)));
  const result = await client.query(
    `SELECT id, tenant_id AS "tenantId", source, provider, model,
            input_tokens AS "inputTokens", output_tokens AS "outputTokens",
            total_tokens AS "totalTokens", latency_ms AS "latencyMs",
            created_at AS "createdAt"
       FROM llm_usage_events
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [tenantId, safeLimit]
  );
  return mapRows(result.rows);
}

export async function sumForTenant(client, tenantId) {
  const result = await client.query(
    `SELECT COALESCE(SUM(input_tokens), 0)::int AS "inputTokens",
            COALESCE(SUM(output_tokens), 0)::int AS "outputTokens",
            COALESCE(SUM(total_tokens), 0)::int AS "totalTokens",
            COUNT(*)::int AS "events"
       FROM llm_usage_events
      WHERE tenant_id = $1`,
    [tenantId]
  );
  return toCamelCase(result.rows[0]);
}
