import { loadImpersonation } from "./PlatformImpersonationService.js";
import { ensureBetaTenant, firstTenantId } from "./TenantOnboardingService.js";

export const WEBSITE_VIEWABLE_DOC_KINDS = [
  "kbis",
  "id_recto",
  "id_verso",
  "address_proof",
];

export function resolveWebsiteProfileTenantId({
  impersonationTenantId = null,
  firstTenantId: ownTenantId = null,
} = {}) {
  return impersonationTenantId || ownTenantId || null;
}

export async function websiteTenantIdForRequest(request) {
  const impersonation = await loadImpersonation(request);
  const ownTenantId = request.user?.id ? await firstTenantId(request.user.id) : null;
  return resolveWebsiteProfileTenantId({
    impersonationTenantId: impersonation?.tenantId || null,
    firstTenantId: ownTenantId,
  });
}

export async function websiteWriteTenantIdForRequest(request, ensureOptions) {
  const impersonatedTenantId = (await loadImpersonation(request))?.tenantId;
  if (impersonatedTenantId) return impersonatedTenantId;
  return ensureBetaTenant(request.user, ensureOptions);
}

export function assertViewableWebsiteDocumentKind(kind) {
  if (!WEBSITE_VIEWABLE_DOC_KINDS.includes(kind)) {
    const err = new Error("Type de pièce invalide");
    err.statusCode = 400;
    throw err;
  }
  return kind;
}

export function websiteDocumentFilename(kind, mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  const ext = mime.includes("pdf")
    ? "pdf"
    : mime.includes("png")
      ? "png"
      : mime.includes("webp")
        ? "webp"
        : "jpg";
  return `${kind}.${ext}`;
}
