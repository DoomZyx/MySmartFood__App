export const PLATFORM_UPLOAD_DOC_KINDS = new Set([
  "id_recto",
  "id_verso",
  "address_proof",
]);

export function requireTenantForDocuments(tenant) {
  if (!tenant) {
    const err = new Error("Établissement introuvable");
    err.statusCode = 404;
    throw err;
  }
  return tenant;
}
