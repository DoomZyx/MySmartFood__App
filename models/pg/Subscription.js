import { getPool } from "../../database/pool.js";
import { toCamelCase } from "../../utils/rowMapper.js";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export function isAccessGranted(status) {
  return ACTIVE_STATUSES.has(status);
}

export async function findCurrentByTenant(tenantId) {
  const result = await getPool().query(
    `SELECT id, tenant_id AS "tenantId", plan_id AS "planId",
            stripe_customer_id AS "stripeCustomerId",
            stripe_subscription_id AS "stripeSubscriptionId",
            status, current_period_start AS "currentPeriodStart",
            current_period_end AS "currentPeriodEnd",
            cancel_at_period_end AS "cancelAtPeriodEnd", canceled_at AS "canceledAt"
       FROM subscriptions
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [tenantId]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function createManual(client, data) {
  const db = client || getPool();
  const result = await db.query(
    `INSERT INTO subscriptions (
        tenant_id, plan_id, status, current_period_start, current_period_end
     ) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, tenant_id AS "tenantId", plan_id AS "planId", status`,
    [
      data.tenantId,
      data.planId,
      data.status || "active",
      data.currentPeriodStart || new Date(),
      data.currentPeriodEnd || null,
    ]
  );
  return toCamelCase(result.rows[0]);
}

export async function upsertFromStripe(client, data) {
  const db = client || getPool();
  const result = await db.query(
    `INSERT INTO subscriptions (
        tenant_id, plan_id, stripe_customer_id, stripe_subscription_id,
        status, current_period_start, current_period_end, cancel_at_period_end, canceled_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        status = EXCLUDED.status,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        canceled_at = EXCLUDED.canceled_at
     RETURNING id`,
    [
      data.tenantId,
      data.planId,
      data.stripeCustomerId || null,
      data.stripeSubscriptionId,
      data.status,
      data.currentPeriodStart || null,
      data.currentPeriodEnd || null,
      Boolean(data.cancelAtPeriodEnd),
      data.canceledAt || null,
    ]
  );
  return result.rows[0];
}

export async function markCanceled(stripeSubscriptionId) {
  await getPool().query(
    `UPDATE subscriptions
        SET status = 'canceled', canceled_at = NOW()
      WHERE stripe_subscription_id = $1`,
    [stripeSubscriptionId]
  );
}

export async function findByStripeSubscriptionId(stripeSubscriptionId) {
  const result = await getPool().query(
    `SELECT id, tenant_id AS "tenantId", plan_id AS "planId", status
       FROM subscriptions WHERE stripe_subscription_id = $1`,
    [stripeSubscriptionId]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}
