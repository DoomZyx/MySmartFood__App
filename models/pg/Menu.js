import { toCamelCase, mapRows } from "../../utils/rowMapper.js";

export async function listCategories(client, tenantId) {
  const result = await client.query(
    `SELECT id, name, slug, sort_order AS "sortOrder"
       FROM menu_categories WHERE tenant_id = $1
      ORDER BY sort_order, name`,
    [tenantId]
  );
  return mapRows(result.rows);
}

export async function upsertCategory(client, tenantId, { name, slug, sortOrder = 0 }) {
  const result = await client.query(
    `INSERT INTO menu_categories (tenant_id, name, slug, sort_order)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_id, name) DO UPDATE SET
        slug = EXCLUDED.slug,
        sort_order = EXCLUDED.sort_order
     RETURNING id, name, slug, sort_order AS "sortOrder"`,
    [tenantId, name, slug, sortOrder]
  );
  return toCamelCase(result.rows[0]);
}

export async function findCategoryBySlug(client, tenantId, slug) {
  const result = await client.query(
    `SELECT id, name, slug, sort_order AS "sortOrder"
       FROM menu_categories WHERE tenant_id = $1 AND slug = $2`,
    [tenantId, slug]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function insertItem(client, tenantId, data) {
  const result = await client.query(
    `INSERT INTO menu_items (
        tenant_id, category_id, name, slug, description, price_cents, is_available,
        sort_order, size_label, is_customizable, max_meats, composition_text,
        included_ingredients, available_ingredients, legacy_payload
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb)
     RETURNING *`,
    [
      tenantId,
      data.categoryId,
      data.name,
      data.slug,
      data.description || null,
      data.priceCents,
      data.isAvailable !== false,
      data.sortOrder || 0,
      data.sizeLabel || null,
      data.isCustomizable || false,
      data.maxMeats || null,
      data.compositionText || null,
      JSON.stringify(data.includedIngredients || {}),
      JSON.stringify(data.availableIngredients || {}),
      JSON.stringify(data.legacyPayload || {}),
    ]
  );
  return toCamelCase(result.rows[0]);
}

export async function updateItem(client, tenantId, id, data) {
  const result = await client.query(
    `UPDATE menu_items SET
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        price_cents = COALESCE($5, price_cents),
        is_available = COALESCE($6, is_available),
        size_label = COALESCE($7, size_label),
        is_customizable = COALESCE($8, is_customizable),
        max_meats = COALESCE($9, max_meats),
        composition_text = COALESCE($10, composition_text),
        included_ingredients = COALESCE($11::jsonb, included_ingredients),
        available_ingredients = COALESCE($12::jsonb, available_ingredients),
        legacy_payload = COALESCE($13::jsonb, legacy_payload)
      WHERE tenant_id = $1 AND id = $2
      RETURNING *`,
    [
      tenantId,
      id,
      data.name || null,
      data.description ?? null,
      data.priceCents ?? null,
      data.isAvailable ?? null,
      data.sizeLabel ?? null,
      data.isCustomizable ?? null,
      data.maxMeats ?? null,
      data.compositionText ?? null,
      data.includedIngredients ? JSON.stringify(data.includedIngredients) : null,
      data.availableIngredients ? JSON.stringify(data.availableIngredients) : null,
      data.legacyPayload ? JSON.stringify(data.legacyPayload) : null,
    ]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function deleteItem(client, tenantId, id) {
  const result = await client.query(
    `DELETE FROM menu_items WHERE tenant_id = $1 AND id = $2 RETURNING id`,
    [tenantId, id]
  );
  return Boolean(result.rows[0]);
}

export async function findItemById(client, tenantId, id) {
  const result = await client.query(
    `SELECT * FROM menu_items WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function findItemByName(client, tenantId, name) {
  const result = await client.query(
    `SELECT * FROM menu_items WHERE tenant_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
    [tenantId, name]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function listItems(client, tenantId, { availableOnly = false } = {}) {
  const result = await client.query(
    `SELECT * FROM menu_items
      WHERE tenant_id = $1 AND ($2 = FALSE OR is_available = TRUE)
      ORDER BY sort_order, name`,
    [tenantId, availableOnly]
  );
  return result.rows.map(toCamelCase);
}

export async function replaceCategories(client, tenantId) {
  await client.query(`DELETE FROM menu_categories WHERE tenant_id = $1`, [tenantId]);
}

export async function upsertOptionGroup(client, tenantId, data) {
  const result = await client.query(
    `INSERT INTO menu_option_groups (
        tenant_id, name, slug, selection_type, min_select, max_select, is_required, sort_order, legacy_payload
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     ON CONFLICT (tenant_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        selection_type = EXCLUDED.selection_type,
        min_select = EXCLUDED.min_select,
        max_select = EXCLUDED.max_select,
        is_required = EXCLUDED.is_required,
        sort_order = EXCLUDED.sort_order
     RETURNING *`,
    [
      tenantId,
      data.name,
      data.slug,
      data.selectionType || "single",
      data.minSelect ?? 0,
      data.maxSelect ?? null,
      data.isRequired || false,
      data.sortOrder || 0,
      JSON.stringify(data.legacyPayload || {}),
    ]
  );
  return toCamelCase(result.rows[0]);
}

export async function replaceGroupOptions(client, tenantId, groupId, options) {
  await client.query(
    `DELETE FROM menu_options WHERE tenant_id = $1 AND group_id = $2`,
    [tenantId, groupId]
  );
  const created = [];
  for (const [index, option] of options.entries()) {
    const result = await client.query(
      `INSERT INTO menu_options (tenant_id, group_id, name, price_cents, is_available, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        tenantId,
        groupId,
        option.name,
        option.priceCents || 0,
        option.isAvailable !== false,
        option.sortOrder ?? index,
      ]
    );
    created.push(toCamelCase(result.rows[0]));
  }
  return created;
}

export async function linkItemGroup(client, tenantId, itemId, groupId) {
  await client.query(
    `INSERT INTO menu_item_option_groups (tenant_id, item_id, group_id)
     VALUES ($1,$2,$3)
     ON CONFLICT DO NOTHING`,
    [tenantId, itemId, groupId]
  );
}

export async function replaceItemGroups(client, tenantId, itemId) {
  await client.query(
    `DELETE FROM menu_item_option_groups WHERE tenant_id = $1 AND item_id = $2`,
    [tenantId, itemId]
  );
}

export async function replaceCompositions(client, tenantId, itemId, rows) {
  await client.query(
    `DELETE FROM menu_compositions WHERE tenant_id = $1 AND item_id = $2`,
    [tenantId, itemId]
  );
  for (const [index, row] of (rows || []).entries()) {
    await client.query(
      `INSERT INTO menu_compositions (
          tenant_id, item_id, component_item_id, role, label, is_choice, sort_order, legacy_payload
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        tenantId,
        itemId,
        row.componentItemId || null,
        row.role || "autre",
        row.label || null,
        row.isChoice || false,
        row.sortOrder ?? index,
        JSON.stringify(row.legacyPayload || {}),
      ]
    );
  }
}

export async function loadCatalog(client, tenantId) {
  const [categories, items, groups, options, links, compositions] = await Promise.all([
    listCategories(client, tenantId),
    listItems(client, tenantId),
    client.query(`SELECT * FROM menu_option_groups WHERE tenant_id = $1 ORDER BY sort_order`, [tenantId]),
    client.query(`SELECT * FROM menu_options WHERE tenant_id = $1 ORDER BY sort_order`, [tenantId]),
    client.query(`SELECT * FROM menu_item_option_groups WHERE tenant_id = $1`, [tenantId]),
    client.query(
      `SELECT * FROM menu_compositions WHERE tenant_id = $1 ORDER BY sort_order`,
      [tenantId]
    ),
  ]);
  return {
    categories,
    items,
    groups: groups.rows.map(toCamelCase),
    options: options.rows.map(toCamelCase),
    links: links.rows.map(toCamelCase),
    compositions: compositions.rows.map(toCamelCase),
  };
}
