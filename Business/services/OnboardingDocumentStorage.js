import * as OnboardingDocument from "../../models/pg/OnboardingDocument.js";
import { writeEncryptedDocument } from "../../utils/documentCrypto.js";
import { compressToWebp } from "../../utils/imageWebp.js";

const PHOTO_KINDS = new Set(["id_recto", "id_verso", "address_proof"]);

export async function persistOnboardingDocument({
  tenantId,
  userId,
  kind,
  buffer,
  mimeType,
  filename,
}) {
  const converted = PHOTO_KINDS.has(kind)
    ? await compressToWebp(buffer, mimeType, filename)
    : { buffer, mimeType: mimeType || "application/octet-stream" };
  const stored = await writeEncryptedDocument(tenantId, kind, converted.buffer);
  return OnboardingDocument.upsertEncrypted({
    tenantId,
    uploadedByUserId: userId,
    kind,
    storagePath: stored.storagePath,
    mimeType: converted.mimeType,
    byteSize: stored.byteSize,
    contentSha256: stored.sha256,
    encryptionIv: stored.iv,
    encryptionAuthTag: stored.authTag,
    ciphertext: stored.ciphertext,
    retentionUntil: new Date(
      Date.now() + (Number(process.env.DOCUMENT_RETENTION_DAYS) || 90) * 86400000
    ),
  });
}
