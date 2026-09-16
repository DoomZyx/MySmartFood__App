import { toCamelCase } from "../../utils/rowMapper.js";

export async function findByPeriod(client, tenantId, periodStart) {
  const result = await client.query(
    `SELECT id, tenant_id AS "tenantId", period_start AS "periodStart",
            period_end AS "periodEnd", minutes_included AS "minutesIncluded",
            seconds_used AS "secondsUsed", client_ref AS "clientRef",
            subscription_key AS "subscriptionKey"
       FROM call_quotas
      WHERE tenant_id = $1 AND period_start = $2
      LIMIT 1`,
    [tenantId, periodStart]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function upsertPeriod(client, tenantId, data) {
  const result = await client.query(
    `INSERT INTO call_quotas (
        tenant_id, period_start, period_end, minutes_included, seconds_used,
        client_ref, subscription_key, legacy_payload
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     ON CONFLICT (tenant_id, period_start) DO UPDATE SET
        period_end = EXCLUDED.period_end,
        minutes_included = EXCLUDED.minutes_included,
        client_ref = COALESCE(EXCLUDED.client_ref, call_quotas.client_ref),
        subscription_key = COALESCE(EXCLUDED.subscription_key, call_quotas.subscription_key)
     RETURNING id, tenant_id AS "tenantId", period_start AS "periodStart",
               period_end AS "periodEnd", minutes_included AS "minutesIncluded",
               seconds_used AS "secondsUsed", client_ref AS "clientRef",
               subscription_key AS "subscriptionKey"`,
    [
      tenantId,
      data.periodStart,
      data.periodEnd,
      data.minutesIncluded,
      data.secondsUsed ?? 0,
      data.clientRef || null,
      data.subscriptionKey || null,
      JSON.stringify(data.legacyPayload || {}),
    ]
  );
  return toCamelCase(result.rows[0]);
}

export async function addSeconds(client, tenantId, periodStart, seconds, extras = {}) {
  const existing = await findByPeriod(client, tenantId, periodStart);
  if (!existing) {
    return upsertPeriod(client, tenantId, {
      periodStart,
      periodEnd: extras.periodEnd,
      minutesIncluded: extras.minutesIncluded,
      secondsUsed: Math.max(0, Number(seconds) || 0),
      clientRef: extras.clientRef || null,
      subscriptionKey: extras.subscriptionKey || null,
    });
  }
  const result = await client.query(
    `UPDATE call_quotas
        SET seconds_used = seconds_used + $3
      WHERE tenant_id = $1 AND period_start = $2
      RETURNING id, tenant_id AS "tenantId", period_start AS "periodStart",
                period_end AS "periodEnd", minutes_included AS "minutesIncluded",
                seconds_used AS "secondsUsed", client_ref AS "clientRef",
                subscription_key AS "subscriptionKey"`,
    [tenantId, periodStart, Math.max(0, Number(seconds) || 0)]
  );
  return toCamelCase(result.rows[0]);
}

export async function resetPeriod(client, tenantId, periodStart, data) {
  return upsertPeriod(client, tenantId, {
    ...data,
    periodStart,
    secondsUsed: 0,
  });
}
