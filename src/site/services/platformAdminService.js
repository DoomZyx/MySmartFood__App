import { apiBaseUrl } from "./apiBase";

const API_BASE_URL = apiBaseUrl();

async function platformRequest(path, options = {}) {
  if (!API_BASE_URL) throw new Error("API non configurée.");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    throw new Error(data.error || data.message || "Session expirée, veuillez vous reconnecter.");
  }
  if (response.status === 403) {
    throw new Error(data.error || data.message || "Accès back-office refusé.");
  }
  if (!response.ok) {
    throw new Error(data.error || data.message || "Requête refusée");
  }
  return data;
}

async function csrfHeaders() {
  const data = await platformRequest("/api/csrf-token");
  return { "x-csrf-token": data.token };
}

async function platformMutate(path, options = {}) {
  const csrf = await csrfHeaders();
  return platformRequest(path, {
    ...options,
    headers: {
      ...csrf,
      ...(options.headers || {}),
    },
  });
}

export async function fetchPlatformSession() {
  if (!API_BASE_URL) throw new Error("API non configurée.");
  const response = await fetch(`${API_BASE_URL}/api/platform/session`, {
    credentials: "include",
  });
  if (response.status === 401 || response.status === 403) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || "Requête refusée");
  }
  return data;
}

export function loginPlatformAdmin({ email, password, accessCode }) {
  return platformRequest("/api/platform/login", {
    method: "POST",
    body: JSON.stringify({ email, password, accessCode }),
  });
}

export async function elevateDevPlatformAdmin() {
  if (!import.meta.env.DEV) return null;
  if (!API_BASE_URL) return null;
  const response = await fetch(`${API_BASE_URL}/api/platform/dev-elevate`, {
    method: "POST",
    credentials: "include",
  });
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return null;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || "Élévation back-office refusée");
  }
  return data;
}

export function startPlatformGoogleLogin() {
  const base = apiBaseUrl();
  if (!base) {
    throw new Error("API non configurée (VITE_API_BASE_URL).");
  }
  window.location.assign(`${base}/api/auth/google?return=platform`);
}

export async function fetchPlatformChallenge() {
  if (!API_BASE_URL) throw new Error("API non configurée.");
  const response = await fetch(`${API_BASE_URL}/api/platform/challenge`, {
    credentials: "include",
  });
  if (response.status === 401 || response.status === 403) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || "Requête refusée");
  }
  return data;
}

export function fetchPlatformTotpSetup() {
  return platformRequest("/api/platform/totp/setup");
}

export function confirmPlatformTotp(token) {
  return platformRequest("/api/platform/totp/confirm", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function verifyPlatformTotp(token) {
  return platformRequest("/api/platform/totp/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function fetchPlatformInbox() {
  return platformRequest("/api/platform/inbox");
}

export function createPlatformTenant(payload) {
  return platformMutate("/api/platform/tenants", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePlatformTenant(tenantId, payload) {
  return platformMutate(`/api/platform/tenants/${tenantId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchPlatformTenantUsers(tenantId) {
  return platformRequest(`/api/platform/tenants/${tenantId}/users`);
}

export function updatePlatformTenantUser(tenantId, userId, payload) {
  return platformMutate(`/api/platform/tenants/${tenantId}/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchPlatformTenants(status, queue) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (queue) params.set("queue", queue);
  const query = params.toString() ? `?${params}` : "";
  return platformRequest(`/api/platform/tenants${query}`);
}

export function fetchPlatformTenant(tenantId, { includeClosed = false } = {}) {
  const query = includeClosed ? "?includeClosed=true" : "";
  return platformRequest(`/api/platform/tenants/${tenantId}${query}`);
}

export function fetchPlatformTenantOps(tenantId) {
  return platformRequest(`/api/platform/tenants/${tenantId}/ops`);
}

export function updatePlatformTenantHours(tenantId, horairesOuverture) {
  return platformMutate(`/api/platform/tenants/${tenantId}/hours`, {
    method: "PATCH",
    body: JSON.stringify({ horairesOuverture }),
  });
}

export function updatePlatformTenantMenuItem(tenantId, itemId, payload) {
  return platformMutate(`/api/platform/tenants/${tenantId}/menu-items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function assignPlatformPhone(tenantId, { phoneNumber, phoneNumberSid }) {
  return platformMutate(`/api/platform/tenants/${tenantId}/assign-phone`, {
    method: "POST",
    body: JSON.stringify({ phoneNumber, phoneNumberSid }),
  });
}

export function activatePlatformTenant(tenantId) {
  return platformMutate(`/api/platform/tenants/${tenantId}/activate`, {
    method: "POST",
  });
}

export function rejectPlatformTenant(tenantId, reason) {
  return platformMutate(`/api/platform/tenants/${tenantId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function suspendPlatformTenant(tenantId) {
  return platformMutate(`/api/platform/tenants/${tenantId}/suspend`, {
    method: "POST",
  });
}

export function closePlatformTenant(tenantId) {
  return platformMutate(`/api/platform/tenants/${tenantId}/close`, {
    method: "POST",
  });
}

export async function fetchPlatformDocumentBlob(tenantId, kind) {
  if (!API_BASE_URL) throw new Error("API non configurée.");
  const response = await fetch(
    `${API_BASE_URL}/api/platform/tenants/${encodeURIComponent(tenantId)}/documents/${encodeURIComponent(kind)}`,
    { credentials: "include" }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || data.message || "Pièce indisponible");
  }
  return {
    blob: await response.blob(),
    mimeType: response.headers.get("content-type") || "application/octet-stream",
  };
}

export async function uploadPlatformTenantDocument(tenantId, kind, file) {
  if (!API_BASE_URL) throw new Error("API non configurée.");
  const csrf = await csrfHeaders();
  const body = new FormData();
  body.append("kind", kind);
  body.append("file", file);
  const response = await fetch(
    `${API_BASE_URL}/api/platform/tenants/${encodeURIComponent(tenantId)}/documents`,
    {
      method: "POST",
      credentials: "include",
      headers: csrf,
      body,
    }
  );
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    throw new Error(data.error || data.message || "Session expirée, veuillez vous reconnecter.");
  }
  if (response.status === 403) {
    throw new Error(data.error || data.message || "Accès back-office refusé.");
  }
  if (!response.ok) {
    throw new Error(data.error || data.message || "Envoi de la pièce refusé");
  }
  return data;
}

export function updateContactStatus(id, status) {
  return platformMutate(`/api/contact/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function updateDemoStatus(id, status) {
  return platformMutate(`/api/demo/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function fetchPlatformStaff() {
  return platformRequest("/api/platform/staff");
}

export function createPlatformStaff({ email, password, name, role }) {
  return platformMutate("/api/platform/staff", {
    method: "POST",
    body: JSON.stringify({ email, password, name, role }),
  });
}

export function updatePlatformStaff(userId, payload) {
  return platformMutate(`/api/platform/staff/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function revokePlatformStaff(userId) {
  return platformMutate(`/api/platform/staff/${userId}/revoke`, {
    method: "POST",
  });
}

export function fetchPlatformUsers(search, { limit, offset } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (limit != null) params.set("limit", String(limit));
  if (offset != null) params.set("offset", String(offset));
  const query = params.toString() ? `?${params}` : "";
  return platformRequest(`/api/platform/users${query}`);
}

export function fetchPlatformUser(userId) {
  return platformRequest(`/api/platform/users/${encodeURIComponent(userId)}`);
}

export function addPlatformTenantUser(tenantId, payload) {
  return platformMutate(`/api/platform/tenants/${tenantId}/users`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function removePlatformTenantUser(tenantId, userId) {
  return platformMutate(`/api/platform/tenants/${tenantId}/users/${userId}`, {
    method: "DELETE",
  });
}

export function updatePlatformLeadNote(kind, leadId, internalNote) {
  return platformMutate(`/api/platform/leads/${kind}/${leadId}`, {
    method: "PATCH",
    body: JSON.stringify({ internalNote }),
  });
}

export function convertPlatformLead(kind, leadId) {
  return platformMutate(`/api/platform/leads/${kind}/${leadId}/convert`, {
    method: "POST",
  });
}

export function updatePlatformUser(userId, payload) {
  return platformMutate(`/api/platform/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deletePlatformUser(userId) {
  return platformMutate(`/api/platform/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export function startPlatformImpersonation({ userId, tenantId }) {
  return platformMutate("/api/platform/impersonate", {
    method: "POST",
    body: JSON.stringify({ userId, tenantId }),
  });
}

export function stopPlatformImpersonation() {
  return platformMutate("/api/platform/impersonate/stop", {
    method: "POST",
  });
}
