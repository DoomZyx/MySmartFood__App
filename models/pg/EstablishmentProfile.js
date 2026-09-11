import { getPool } from "../../database/pool.js";
import { toCamelCase } from "../../utils/rowMapper.js";

const PROFILE_COLUMNS = `tenant_id AS "tenantId", business_name AS "businessName", address_line AS "addressLine",
            postal_code AS "postalCode", city, country, phone, email,
            seat_count AS "seatCount", cuisine_type AS "cuisineType",
            phone_number_usage AS "phoneNumberUsage",
            documents_submitted_at AS "documentsSubmittedAt",
            raw_address AS "rawAddress", latitude, longitude, legacy_payload AS "legacyPayload"`;

export async function findByTenantId(tenantId, client) {
  const db = client || getPool();
  const result = await db.query(
    `SELECT ${PROFILE_COLUMNS}
       FROM establishment_profiles WHERE tenant_id = $1`,
    [tenantId]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function upsert(tenantId, data, client) {
  const db = client || getPool();
  const result = await db.query(
    `INSERT INTO establishment_profiles (
        tenant_id, business_name, address_line, postal_code, city, country,
        phone, email, seat_count, cuisine_type, phone_number_usage,
        raw_address, latitude, longitude, legacy_payload
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
     ON CONFLICT (tenant_id) DO UPDATE SET
        business_name = EXCLUDED.business_name,
        address_line = EXCLUDED.address_line,
        postal_code = EXCLUDED.postal_code,
        city = EXCLUDED.city,
        country = EXCLUDED.country,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        seat_count = EXCLUDED.seat_count,
        cuisine_type = EXCLUDED.cuisine_type,
        phone_number_usage = EXCLUDED.phone_number_usage,
        raw_address = COALESCE(EXCLUDED.raw_address, establishment_profiles.raw_address),
        latitude = COALESCE(EXCLUDED.latitude, establishment_profiles.latitude),
        longitude = COALESCE(EXCLUDED.longitude, establishment_profiles.longitude),
        legacy_payload = establishment_profiles.legacy_payload || EXCLUDED.legacy_payload
     RETURNING ${PROFILE_COLUMNS}`,
    [
      tenantId,
      data.businessName,
      data.addressLine || data.rawAddress || "",
      data.postalCode || "",
      data.city || "",
      data.country || "France",
      data.phone || "",
      data.email || "",
      data.seatCount ?? null,
      data.cuisineType ?? null,
      data.phoneNumberUsage ?? null,
      data.rawAddress || data.addressLine || null,
      data.latitude ?? null,
      data.longitude ?? null,
      JSON.stringify(data.legacyPayload || {}),
    ]
  );
  return toCamelCase(result.rows[0]);
}

export async function markDocumentsSubmitted(tenantId) {
  await getPool().query(
    `UPDATE establishment_profiles SET documents_submitted_at = NOW() WHERE tenant_id = $1`,
    [tenantId]
  );
}
