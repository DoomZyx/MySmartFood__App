import { getPool } from "../../database/pool.js";
import { toCamelCase, mapRows } from "../../utils/rowMapper.js";

export async function upsertEncrypted(doc) {
  const result = await getPool().query(
    `INSERT INTO onboarding_documents (
        tenant_id, uploaded_by_user_id, kind, storage_path, mime_type, byte_size,
        content_sha256, encryption_iv, encryption_auth_tag, retention_until
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (tenant_id, kind) DO UPDATE SET
        storage_path = EXCLUDED.storage_path,
        mime_type = EXCLUDED.mime_type,
        byte_size = EXCLUDED.byte_size,
        content_sha256 = EXCLUDED.content_sha256,
        encryption_iv = EXCLUDED.encryption_iv,
        encryption_auth_tag = EXCLUDED.encryption_auth_tag,
        retention_until = EXCLUDED.retention_until,
        purged_at = NULL,
        uploaded_by_user_id = EXCLUDED.uploaded_by_user_id
     RETURNING id, kind, storage_path AS "storagePath"`,
    [
      doc.tenantId,
      doc.uploadedByUserId,
      doc.kind,
      doc.storagePath,
      doc.mimeType,
      doc.byteSize,
      doc.contentSha256,
      doc.encryptionIv,
      doc.encryptionAuthTag,
      doc.retentionUntil,
    ]
  );
  return toCamelCase(result.rows[0]);
}

export async function listActiveByTenant(tenantId) {
  const result = await getPool().query(
    `SELECT id, kind, storage_path AS "storagePath", mime_type AS "mimeType",
            encryption_iv AS "encryptionIv", encryption_auth_tag AS "encryptionAuthTag",
            purged_at AS "purgedAt"
       FROM onboarding_documents
      WHERE tenant_id = $1 AND purged_at IS NULL`,
    [tenantId]
  );
  return mapRows(result.rows);
}

export async function listExpired() {
  const result = await getPool().query(
    `SELECT id, storage_path AS "storagePath"
       FROM onboarding_documents
      WHERE purged_at IS NULL AND retention_until < NOW()`
  );
  return mapRows(result.rows);
}

export async function markPurged(id) {
  await getPool().query(
    `UPDATE onboarding_documents SET purged_at = NOW() WHERE id = $1`,
    [id]
  );
}
