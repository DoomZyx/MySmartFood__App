import { toCamelCase, mapRows } from "../../utils/rowMapper.js";

function formatTime(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 5);
  if (value instanceof Date) {
    return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
  }
  return String(value).slice(0, 5);
}

export async function replaceAll(client, tenantId, slots) {
  await client.query(`DELETE FROM opening_hours WHERE tenant_id = $1`, [tenantId]);
  for (const slot of slots) {
    await client.query(
      `INSERT INTO opening_hours (
          tenant_id, day_of_week, slot_kind, opens_at, closes_at, closes_next_day
       ) VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        tenantId,
        slot.dayOfWeek,
        slot.slotKind,
        slot.opensAt,
        slot.closesAt,
        slot.closesNextDay || false,
      ]
    );
  }
}

export async function list(client, tenantId) {
  const result = await client.query(
    `SELECT id, day_of_week AS "dayOfWeek", slot_kind AS "slotKind",
            opens_at, closes_at, closes_next_day AS "closesNextDay"
       FROM opening_hours
      WHERE tenant_id = $1
      ORDER BY day_of_week, slot_kind`,
    [tenantId]
  );
  return result.rows.map((row) => ({
    ...toCamelCase(row),
    opensAt: formatTime(row.opens_at),
    closesAt: formatTime(row.closes_at),
  }));
}

export { formatTime, mapRows };
