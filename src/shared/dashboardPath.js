const LEGACY_ENCODED = "bXlzbWFydGZvb2QtZGFzaGJvYXJk";

function normalizePath(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "/app";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/** Application restaurateur : /app sur le domaine vitrine. */
export const DASHBOARD_PATH = normalizePath(import.meta.env.VITE_APP_URL || "/app");

export const LEGACY_DASHBOARD_PATH = `/d/${LEGACY_ENCODED}`;

export function dashboardPagePath(page = "") {
  const extra = String(page || "").replace(/^\/+/, "");
  return extra ? `${DASHBOARD_PATH}/${extra}` : DASHBOARD_PATH;
}

export function rewriteLegacyDashboardPath(pathname) {
  const current = String(pathname || "");
  if (current === LEGACY_DASHBOARD_PATH) return DASHBOARD_PATH;
  if (current.startsWith(`${LEGACY_DASHBOARD_PATH}/`)) {
    return `${DASHBOARD_PATH}${current.slice(LEGACY_DASHBOARD_PATH.length)}`;
  }
  return current;
}

export function dashboardHomeHref() {
  return DASHBOARD_PATH;
}

export function openDashboard(navigate, { replace = true } = {}) {
  const href = dashboardHomeHref();
  if (typeof window !== "undefined" && window.location.pathname === href) {
    return;
  }
  if (/^https?:\/\//i.test(href)) {
    window.location.assign(href);
    return;
  }
  if (typeof navigate === "function") {
    navigate(href, { replace });
    return;
  }
  window.location.assign(href);
}
