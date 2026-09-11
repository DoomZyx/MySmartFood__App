import { getPool } from "../../database/pool.js";
import { toCamelCase } from "../../utils/rowMapper.js";

export async function insert(client, { userId, tenantId, tokenHash, expiresAt }) {
  const db = client || getPool();
  const result = await db.query(
    `INSERT INTO dashboard_access_tokens (user_id, tenant_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id AS "userId", tenant_id AS "tenantId", expires_at AS "expiresAt"`,
    [userId, tenantId, tokenHash, expiresAt]
  );
  return toCamelCase(result.rows[0]);
}

export async function findValidByHash(tokenHash) {
  const result = await getPool().query(
    `SELECT id, user_id AS "userId", tenant_id AS "tenantId", expires_at AS "expiresAt", consumed_at AS "consumedAt"
       FROM dashboard_access_tokens
      WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > NOW()
      LIMIT 1`,
    [tokenHash]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function markConsumed(id) {
  await getPool().query(
    `UPDATE dashboard_access_tokens SET consumed_at = NOW() WHERE id = $1`,
    [id]
  );
}
