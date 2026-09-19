import { toCamelCase, mapRows } from "../../utils/rowMapper.js";

export async function insert(client, tenantId, { notificationType, payload }) {
  const result = await client.query(
    `INSERT INTO dashboard_notifications (tenant_id, notification_type, payload)
     VALUES ($1, $2, $3::jsonb)
     RETURNING id, tenant_id AS "tenantId", notification_type AS "notificationType",
               payload, created_at AS "createdAt", read_at AS "readAt"`,
    [tenantId, notificationType, JSON.stringify(payload || {})]
  );
  return toCamelCase(result.rows[0]);
}

export async function listUnread(client, tenantId, { limit = 20 } = {}) {
  const result = await client.query(
    `SELECT id, tenant_id AS "tenantId", notification_type AS "notificationType",
            payload, created_at AS "createdAt", read_at AS "readAt"
       FROM dashboard_notifications
      WHERE tenant_id = $1
        AND read_at IS NULL
      ORDER BY created_at DESC
      LIMIT $2`,
    [tenantId, limit]
  );
  return mapRows(result.rows);
}

export async function markRead(client, tenantId, id) {
  const result = await client.query(
    `UPDATE dashboard_notifications
        SET read_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
        AND read_at IS NULL
     RETURNING id, read_at AS "readAt"`,
    [tenantId, id]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function markAllRead(client, tenantId) {
  const result = await client.query(
    `UPDATE dashboard_notifications
        SET read_at = NOW()
      WHERE tenant_id = $1
        AND read_at IS NULL`,
    [tenantId]
  );
  return result.rowCount || 0;
}
