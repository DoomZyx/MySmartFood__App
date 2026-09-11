import { toCamelCase, mapRows } from "../../utils/rowMapper.js";

function insertItemOptions(client, tenantId, orderItemId, options) {
  const entries = normalizeOptionEntries(options);
  return Promise.all(
    entries.map((entry) =>
      client.query(
        `INSERT INTO order_item_options (
            tenant_id, order_item_id, group_name, option_name, price_cents, legacy_payload
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        [
          tenantId,
          orderItemId,
          entry.groupName,
          entry.optionName,
          entry.priceCents || 0,
          JSON.stringify(entry.legacyPayload || {}),
        ]
      )
    )
  );
}

export function normalizeOptionEntries(options) {
  if (!options) return [];
  if (Array.isArray(options)) {
    return options.map((item) => ({
      groupName: item.groupName || item.group || "option",
      optionName: item.optionName || item.name || String(item),
      priceCents: item.priceCents || 0,
      legacyPayload: item,
    }));
  }
  if (typeof options === "object") {
    return Object.entries(options).flatMap(([groupName, value]) => {
      if (Array.isArray(value)) {
        return value.map((optionName) => ({
          groupName,
          optionName: String(optionName),
          priceCents: 0,
          legacyPayload: { [groupName]: value },
        }));
      }
      if (value && typeof value === "object") {
        const names = value.choix || value.selected || [];
        if (Array.isArray(names)) {
          return names.map((optionName) => ({
            groupName,
            optionName: String(optionName),
            priceCents: 0,
            legacyPayload: value,
          }));
        }
        return [
          {
            groupName,
            optionName: JSON.stringify(value),
            priceCents: 0,
            legacyPayload: value,
          },
        ];
      }
      return [
        {
          groupName,
          optionName: String(value),
          priceCents: 0,
          legacyPayload: { [groupName]: value },
        },
      ];
    });
  }
  return [];
}

export async function create(client, tenantId, data) {
  const order = await client.query(
    `INSERT INTO orders (
        tenant_id, client_id, status, source, total_cents, pickup_at, notes,
        guest_name, guest_phone, legacy_status, created_by,
        reminder_email_sent, reminder_sms_sent, related_call, legacy_payload
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
     RETURNING *`,
    [
      tenantId,
      data.clientId || null,
      data.status || "pending",
      data.source || "dashboard",
      data.totalCents || 0,
      data.pickupAt || null,
      data.notes || null,
      data.guestName || null,
      data.guestPhone || null,
      data.legacyStatus || null,
      data.createdBy || "manual",
      data.reminderEmailSent || false,
      data.reminderSmsSent || false,
      data.relatedCall || null,
      JSON.stringify(data.legacyPayload || {}),
    ]
  );
  const created = toCamelCase(order.rows[0]);
  for (const item of data.items || []) {
    const inserted = await client.query(
      `INSERT INTO order_items (
          tenant_id, order_id, menu_item_id, label, quantity, unit_price_cents,
          category, composition, legacy_payload
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       RETURNING id`,
      [
        tenantId,
        created.id,
        item.menuItemId || null,
        item.label,
        item.quantity,
        item.unitPriceCents,
        item.category || null,
        item.composition || null,
        JSON.stringify(item.legacyPayload || {}),
      ]
    );
    await insertItemOptions(client, tenantId, inserted.rows[0].id, item.options);
  }
  return findById(client, tenantId, created.id);
}

export async function list(client, tenantId, filters = {}) {
  const values = [tenantId];
  const clauses = ["o.tenant_id = $1"];
  if (filters.status) {
    values.push(filters.status);
    clauses.push(`o.status = $${values.length}`);
  }
  if (filters.legacyStatus) {
    values.push(filters.legacyStatus);
    clauses.push(`o.legacy_status = $${values.length}`);
  }
  if (filters.from) {
    values.push(filters.from);
    clauses.push(`o.pickup_at >= $${values.length}`);
  }
  if (filters.to) {
    values.push(filters.to);
    clauses.push(`o.pickup_at < $${values.length}`);
  }
  const limit = Number(filters.limit) || 50;
  const offset = ((Number(filters.page) || 1) - 1) * limit;
  values.push(limit, offset);
  const result = await client.query(
    `SELECT o.*
       FROM orders o
      WHERE ${clauses.join(" AND ")}
      ORDER BY o.pickup_at DESC NULLS LAST, o.created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  const count = await client.query(
    `SELECT COUNT(*)::int AS total FROM orders o WHERE ${clauses.join(" AND ")}`,
    values.slice(0, values.length - 2)
  );
  const rows = [];
  for (const row of result.rows) {
    rows.push(await hydrateOrder(client, tenantId, row));
  }
  return { rows, total: count.rows[0].total };
}

export async function findById(client, tenantId, id) {
  const result = await client.query(
    `SELECT * FROM orders WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id]
  );
  if (!result.rows[0]) return null;
  return hydrateOrder(client, tenantId, result.rows[0]);
}

export async function update(client, tenantId, id, data) {
  const result = await client.query(
    `UPDATE orders SET
        status = COALESCE($3, status),
        legacy_status = COALESCE($4, legacy_status),
        pickup_at = COALESCE($5, pickup_at),
        notes = COALESCE($6, notes),
        guest_name = COALESCE($7, guest_name),
        guest_phone = COALESCE($8, guest_phone),
        total_cents = COALESCE($9, total_cents),
        related_call = COALESCE($10, related_call)
      WHERE tenant_id = $1 AND id = $2
      RETURNING *`,
    [
      tenantId,
      id,
      data.status || null,
      data.legacyStatus || null,
      data.pickupAt || null,
      data.notes ?? null,
      data.guestName ?? null,
      data.guestPhone ?? null,
      data.totalCents ?? null,
      data.relatedCall ?? null,
    ]
  );
  if (!result.rows[0]) return null;
  if (data.items) {
    await client.query(
      `DELETE FROM order_items WHERE tenant_id = $1 AND order_id = $2`,
      [tenantId, id]
    );
    for (const item of data.items) {
      const inserted = await client.query(
        `INSERT INTO order_items (
            tenant_id, order_id, menu_item_id, label, quantity, unit_price_cents,
            category, composition, legacy_payload
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
         RETURNING id`,
        [
          tenantId,
          id,
          item.menuItemId || null,
          item.label,
          item.quantity,
          item.unitPriceCents,
          item.category || null,
          item.composition || null,
          JSON.stringify(item.legacyPayload || {}),
        ]
      );
      await insertItemOptions(client, tenantId, inserted.rows[0].id, item.options);
    }
  }
  return findById(client, tenantId, id);
}

export async function remove(client, tenantId, id) {
  const result = await client.query(
    `DELETE FROM orders WHERE tenant_id = $1 AND id = $2 RETURNING id`,
    [tenantId, id]
  );
  return Boolean(result.rows[0]);
}

export async function findRecentDuplicate(client, tenantId, { phone, from, to, since }) {
  const result = await client.query(
    `SELECT * FROM orders
      WHERE tenant_id = $1
        AND created_by = 'system'
        AND status <> 'cancelled'
        AND pickup_at >= $2 AND pickup_at < $3
        AND created_at >= $4
        AND regexp_replace(COALESCE(guest_phone, ''), '\\D', '', 'g') = $5
      ORDER BY created_at DESC
      LIMIT 1`,
    [tenantId, from, to, since, phone]
  );
  if (!result.rows[0]) return null;
  return hydrateOrder(client, tenantId, result.rows[0]);
}

async function hydrateOrder(client, tenantId, row) {
  const order = toCamelCase(row);
  const items = await client.query(
    `SELECT * FROM order_items WHERE tenant_id = $1 AND order_id = $2 ORDER BY created_at`,
    [tenantId, order.id]
  );
  const hydrated = [];
  for (const item of items.rows) {
    const mapped = toCamelCase(item);
    const options = await client.query(
      `SELECT group_name AS "groupName", option_name AS "optionName", price_cents AS "priceCents"
         FROM order_item_options
        WHERE tenant_id = $1 AND order_item_id = $2`,
      [tenantId, mapped.id]
    );
    mapped.options = options.rows;
    hydrated.push(mapped);
  }
  order.items = hydrated;
  return order;
}

export async function listAll(client, tenantId) {
  const result = await list(client, tenantId, { limit: 1000, page: 1 });
  return result.rows;
}
