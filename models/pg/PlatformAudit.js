import { getPool } from "../../database/pool.js";
import { toCamelCase } from "../../utils/rowMapper.js";

export async function insert({ actorId, action, targetType, targetId, metadata } = {}) {
  const result = await getPool().query(
    `INSERT INTO platform_audit_events (actor_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, actor_id AS "actorId", action, target_type AS "targetType",
               target_id AS "targetId", metadata, created_at AS "createdAt"`,
    [
      actorId || null,
      String(action || "").trim().slice(0, 80),
      String(targetType || "").trim().slice(0, 40),
      targetId || null,
      JSON.stringify(metadata && typeof metadata === "object" ? metadata : {}),
    ]
  );
  return toCamelCase(result.rows[0]);
}
