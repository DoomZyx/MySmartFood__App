const DEFAULT_ENCODED = "bXlzbWFydGZvb2QtZGFzaGJvYXJk";

function normalizePath(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return `/d/${DEFAULT_ENCODED}`;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export const DASHBOARD_PATH = normalizePath(import.meta.env.VITE_DASHBOARD_PATH);

export function dashboardHomeHref() {
  const origin = String(import.meta.env.VITE_DASHBOARD_URL || "").replace(/\/+$/, "");
  const path = DASHBOARD_PATH;
  if (!origin || typeof window === "undefined") return path;
  const here = window.location.hostname;
  if (here === "localhost" || here === "127.0.0.1") return path;
  try {
    if (new URL(origin).origin === window.location.origin) return path;
  } catch {
    return path;
  }
  return `${origin}${path}`;
}

export function openDashboard(navigate, { replace = true } = {}) {
  const href = dashboardHomeHref();
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
