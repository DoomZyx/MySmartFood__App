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

export function fetchPlatformTenants(status, queue) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (queue) params.set("queue", queue);
  const query = params.toString() ? `?${params}` : "";
  return platformRequest(`/api/platform/tenants${query}`);
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

export function createPlatformStaff({ email, password, name }) {
  return platformMutate("/api/platform/staff", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export function revokePlatformStaff(userId) {
  return platformMutate(`/api/platform/staff/${userId}/revoke`, {
    method: "POST",
  });
}
