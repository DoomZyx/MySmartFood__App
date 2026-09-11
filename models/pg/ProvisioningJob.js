import { getPool } from "../../database/pool.js";
import { toCamelCase } from "../../utils/rowMapper.js";

export async function createProvisioningJob(client, tenantId) {
  const db = client || getPool();
  const result = await db.query(
    `INSERT INTO provisioning_jobs (tenant_id, state)
     VALUES ($1, 'awaiting_documents')
     ON CONFLICT (tenant_id) DO UPDATE SET state = provisioning_jobs.state
     RETURNING id, tenant_id AS "tenantId", state, attempts, last_error AS "lastError", context`,
    [tenantId]
  );
  return toCamelCase(result.rows[0]);
}

export async function findByTenantId(tenantId) {
  const result = await getPool().query(
    `SELECT id, tenant_id AS "tenantId", state, attempts, last_error AS "lastError", context,
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM provisioning_jobs WHERE tenant_id = $1`,
    [tenantId]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function markCompleted(tenantId) {
  const result = await getPool().query(
    `UPDATE provisioning_jobs
        SET state = 'completed', last_error = NULL
      WHERE tenant_id = $1
      RETURNING id, tenant_id AS "tenantId", state`,
    [tenantId]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function transition(tenantId, fromStates, toState, patch = {}) {
  const result = await getPool().query(
    `UPDATE provisioning_jobs
        SET state = $3,
            attempts = attempts + 1,
            last_error = $4,
            context = COALESCE($5::jsonb, context)
      WHERE tenant_id = $1 AND state = ANY($2::text[])
      RETURNING id, tenant_id AS "tenantId", state`,
    [
      tenantId,
      fromStates,
      toState,
      patch.lastError || null,
      patch.context ? JSON.stringify(patch.context) : null,
    ]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}
