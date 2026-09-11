import { getPool } from "../../database/pool.js";
import { toCamelCase } from "../../utils/rowMapper.js";

export async function upsertBundle(data) {
  const result = await getPool().query(
    `INSERT INTO twilio_bundles (tenant_id, bundle_sid, status, end_user_sid)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (bundle_sid) DO UPDATE SET
        status = EXCLUDED.status,
        end_user_sid = COALESCE(EXCLUDED.end_user_sid, twilio_bundles.end_user_sid)
     RETURNING id, tenant_id AS "tenantId", bundle_sid AS "bundleSid", status`,
    [data.tenantId, data.bundleSid, data.status || "draft", data.endUserSid || null]
  );
  return toCamelCase(result.rows[0]);
}

export async function findByBundleSid(bundleSid) {
  const result = await getPool().query(
    `SELECT id, tenant_id AS "tenantId", bundle_sid AS "bundleSid", status,
            phone_number AS "phoneNumber", phone_number_sid AS "phoneNumberSid"
       FROM twilio_bundles WHERE bundle_sid = $1`,
    [bundleSid]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function updateStatus(bundleSid, status, extra = {}) {
  await getPool().query(
    `UPDATE twilio_bundles
        SET status = $2,
            failure_reason = $3,
            reviewed_at = CASE WHEN $2 IN ('twilio-approved', 'twilio-rejected') THEN NOW() ELSE reviewed_at END,
            phone_number = COALESCE($4, phone_number),
            phone_number_sid = COALESCE($5, phone_number_sid)
      WHERE bundle_sid = $1`,
    [bundleSid, status, extra.failureReason || null, extra.phoneNumber || null, extra.phoneNumberSid || null]
  );
}
