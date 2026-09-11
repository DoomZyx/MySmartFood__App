import { getApiKey } from "./apiKey.js";

const VITE_API_URL = import.meta.env.VITE_API_URL || "/";
const TENANT_KEY = "tenantId";
const USER_KEY = "user";

export function getStoredTenantId() {
  return localStorage.getItem(TENANT_KEY) || "";
}

export function setStoredTenantId(tenantId) {
  if (tenantId) localStorage.setItem(TENANT_KEY, tenantId);
  else localStorage.removeItem(TENANT_KEY);
}

export function sessionHeaders(extra = {}) {
  const headers = { ...extra };
  const tenantId = getStoredTenantId();
  if (tenantId) headers["x-tenant-id"] = tenantId;
  const key = getApiKey();
  if (key) headers["x-api-key"] = key;
  return headers;
}

export function apiUrl(path) {
  const clean = String(path || "").replace(/^\//, "");
  return `${VITE_API_URL}${clean}`;
}

export function apiFetch(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  return fetch(apiUrl(path), {
    ...rest,
    credentials: "include",
    headers: sessionHeaders(extraHeaders),
  });
}

export function persistSession({ user, tenants }) {
  if (!user) return;
  const role =
    user.isPlatformAdmin ||
    user.role === "admin" ||
    user.role === "owner" ||
    user.appRole === "admin"
      ? "admin"
      : "user";
  const first = Array.isArray(tenants) && tenants[0] ? tenants[0].id : "";
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      id: user.id,
      email: user.email || "",
      name: user.name || user.email || "",
      username: user.name || user.email || "",
      avatar: user.avatarUrl || user.avatar || null,
      role,
      isPlatformAdmin: Boolean(user.isPlatformAdmin),
      planId: user.planId || null,
      planSlug: user.planSlug || null,
      planName: user.planName || null,
      hasActiveSubscription: Boolean(user.hasActiveSubscription),
      accessUnlocked: Boolean(user.accessUnlocked || user.dashboardUnlockedAt),
      smartcrmInstanceId: user.smartcrmInstanceId || first || null,
    })
  );
  if (first) setStoredTenantId(first);
  localStorage.removeItem("token");
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem(USER_KEY);
  setStoredTenantId("");
}
