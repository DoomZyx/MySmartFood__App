import { toCamelCase } from "../../utils/rowMapper.js";

export async function find(client, tenantId) {
  const result = await client.query(
    `SELECT * FROM tenant_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function upsert(client, tenantId, data = {}) {
  const result = await client.query(
    `INSERT INTO tenant_settings (
        tenant_id, phone_line_enabled, timezone, currency, voice_model, voice_name,
        noise_reduction_enabled, assistant_instructions, transfer_phone,
        reservation_slot_minutes, order_prep_minutes, takeaway_enabled,
        reservation_enabled, legacy_payload
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
     ON CONFLICT (tenant_id) DO UPDATE SET
        phone_line_enabled = COALESCE($2, tenant_settings.phone_line_enabled),
        timezone = COALESCE($3, tenant_settings.timezone),
        transfer_phone = COALESCE($9, tenant_settings.transfer_phone),
        reservation_slot_minutes = COALESCE($10, tenant_settings.reservation_slot_minutes),
        order_prep_minutes = COALESCE($11, tenant_settings.order_prep_minutes),
        takeaway_enabled = COALESCE($12, tenant_settings.takeaway_enabled),
        reservation_enabled = COALESCE($13, tenant_settings.reservation_enabled),
        legacy_payload = tenant_settings.legacy_payload || EXCLUDED.legacy_payload
     RETURNING *`,
    [
      tenantId,
      data.phoneLineEnabled ?? true,
      data.timezone || "Europe/Paris",
      data.currency || "EUR",
      data.voiceModel || "gpt-4o-realtime-mini",
      data.voiceName || "ballad",
      data.noiseReductionEnabled ?? true,
      data.assistantInstructions || null,
      data.transferPhone || null,
      data.reservationSlotMinutes || 30,
      data.orderPrepMinutes || 30,
      data.takeawayEnabled ?? true,
      data.reservationEnabled ?? true,
      JSON.stringify(data.legacyPayload || {}),
    ]
  );
  return toCamelCase(result.rows[0]);
}

export async function setPhoneLineEnabled(client, tenantId, enabled) {
  await upsert(client, tenantId, { phoneLineEnabled: !!enabled });
  return find(client, tenantId);
}
