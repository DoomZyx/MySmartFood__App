import { toCamelCase } from "../../utils/rowMapper.js";

export async function create(client, tenantId, data) {
  const result = await client.query(
    `INSERT INTO reservations (
        tenant_id, client_id, party_size, reserved_at, status, source, notes,
        guest_name, guest_phone, description, internal_notes, legacy_status,
        created_by, reminder_email_sent, reminder_sms_sent, related_call, legacy_payload
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)
     RETURNING *`,
    [
      tenantId,
      data.clientId || null,
      data.partySize,
      data.reservedAt,
      data.status || "pending",
      data.source || "dashboard",
      data.notes || null,
      data.guestName || null,
      data.guestPhone || null,
      data.description || null,
      data.internalNotes || null,
      data.legacyStatus || null,
      data.createdBy || "manual",
      data.reminderEmailSent || false,
      data.reminderSmsSent || false,
      data.relatedCall || null,
      JSON.stringify(data.legacyPayload || {}),
    ]
  );
  return toCamelCase(result.rows[0]);
}

export async function list(client, tenantId, filters = {}) {
  const values = [tenantId];
  const clauses = ["tenant_id = $1"];
  if (filters.status) {
    values.push(filters.status);
    clauses.push(`status = $${values.length}`);
  }
  if (filters.legacyStatus) {
    values.push(filters.legacyStatus);
    clauses.push(`legacy_status = $${values.length}`);
  }
  if (filters.from) {
    values.push(filters.from);
    clauses.push(`reserved_at >= $${values.length}`);
  }
  if (filters.to) {
    values.push(filters.to);
    clauses.push(`reserved_at < $${values.length}`);
  }
  const limit = Number(filters.limit) || 50;
  const offset = ((Number(filters.page) || 1) - 1) * limit;
  values.push(limit, offset);
  const result = await client.query(
    `SELECT * FROM reservations
      WHERE ${clauses.join(" AND ")}
      ORDER BY reserved_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  const count = await client.query(
    `SELECT COUNT(*)::int AS total FROM reservations WHERE ${clauses.join(" AND ")}`,
    values.slice(0, values.length - 2)
  );
  return { rows: result.rows.map(toCamelCase), total: count.rows[0].total };
}

export async function findById(client, tenantId, id) {
  const result = await client.query(
    `SELECT * FROM reservations WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function update(client, tenantId, id, data) {
  const result = await client.query(
    `UPDATE reservations SET
        party_size = COALESCE($3, party_size),
        reserved_at = COALESCE($4, reserved_at),
        status = COALESCE($5, status),
        legacy_status = COALESCE($6, legacy_status),
        notes = COALESCE($7, notes),
        guest_name = COALESCE($8, guest_name),
        guest_phone = COALESCE($9, guest_phone),
        description = COALESCE($10, description),
        internal_notes = COALESCE($11, internal_notes)
      WHERE tenant_id = $1 AND id = $2
      RETURNING *`,
    [
      tenantId,
      id,
      data.partySize ?? null,
      data.reservedAt || null,
      data.status || null,
      data.legacyStatus || null,
      data.notes ?? null,
      data.guestName ?? null,
      data.guestPhone ?? null,
      data.description ?? null,
      data.internalNotes ?? null,
    ]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function remove(client, tenantId, id) {
  const result = await client.query(
    `DELETE FROM reservations WHERE tenant_id = $1 AND id = $2 RETURNING id`,
    [tenantId, id]
  );
  return Boolean(result.rows[0]);
}

export async function findRecentDuplicate(client, tenantId, { phone, from, to, since }) {
  const result = await client.query(
    `SELECT * FROM reservations
      WHERE tenant_id = $1
        AND created_by = 'system'
        AND status <> 'cancelled'
        AND reserved_at >= $2 AND reserved_at < $3
        AND created_at >= $4
        AND regexp_replace(COALESCE(guest_phone, ''), '\\D', '', 'g') = $5
      ORDER BY created_at DESC
      LIMIT 1`,
    [tenantId, from, to, since, phone]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function sumPartySize(client, tenantId, { from, to, excludeCancelled = true }) {
  const result = await client.query(
    `SELECT COALESCE(SUM(party_size), 0)::int AS total
       FROM reservations
      WHERE tenant_id = $1
        AND reserved_at >= $2 AND reserved_at < $3
        AND ($4 = FALSE OR status <> 'cancelled')`,
    [tenantId, from, to, excludeCancelled]
  );
  return result.rows[0].total;
}

export async function listAll(client, tenantId) {
  const result = await list(client, tenantId, { limit: 1000, page: 1 });
  return result.rows;
}
