import { getPool } from "../../database/pool.js";
import { toCamelCase, mapRows } from "../../utils/rowMapper.js";

export async function listActive() {
  const result = await getPool().query(
    `SELECT id, slug, name, stripe_price_id AS "stripePriceId",
            stripe_product_id AS "stripeProductId",
            monthly_call_minutes AS "monthlyCallMinutes",
            price_cents AS "priceCents", sort_order AS "sortOrder"
       FROM plans WHERE is_active = TRUE ORDER BY sort_order`
  );
  return mapRows(result.rows);
}

export async function findById(id) {
  const result = await getPool().query(
    `SELECT id, slug, name, stripe_price_id AS "stripePriceId",
            stripe_product_id AS "stripeProductId",
            monthly_call_minutes AS "monthlyCallMinutes"
       FROM plans WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function findBySlug(slug) {
  const result = await getPool().query(
    `SELECT id, slug, name, stripe_price_id AS "stripePriceId",
            stripe_product_id AS "stripeProductId",
            monthly_call_minutes AS "monthlyCallMinutes"
       FROM plans WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}
