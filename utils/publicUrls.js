function trimUrl(value, fallback) {
  const raw = (value || fallback || "").trim();
  return raw.replace(/\/+$/, "");
}

function hostnameOf(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    if (raw.includes("://")) return new URL(raw).hostname.toLowerCase();
    if (raw.startsWith("//")) return new URL(`https:${raw}`).hostname.toLowerCase();
  } catch {
    return "";
  }
  return raw.split("/")[0].toLowerCase();
}

export function siteUrl() {
  return trimUrl(process.env.SITE_URL, process.env.FRONTEND_URL || "https://www.mysmartfood.fr");
}

export function dashboardUrl() {
  return trimUrl(process.env.DASHBOARD_URL, "https://dashboard.mysmartfood.fr");
}

export function platformAdminPath() {
  const raw = String(process.env.PLATFORM_ADMIN_PATH || "/bf-admin").trim();
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function apiPublicHostname() {
  return hostnameOf(process.env.PUBLIC_HOST) || hostnameOf(process.env.GOOGLE_CALLBACK_URL);
}

export function isApiPublicHost(value) {
  const host = hostnameOf(value);
  if (!host) return false;
  const apiHost = apiPublicHostname();
  if (apiHost && host === apiHost) return true;
  return host.includes(".api.");
}

/** Origine SPA après OAuth : jamais l'hôte API (app.api / *.api). */
export function spaOrigin(value) {
  const raw = trimUrl(value, siteUrl());
  try {
    const url = new URL(raw);
    if (isApiPublicHost(url.origin)) return siteUrl();
    return trimUrl(url.origin);
  } catch {
    return siteUrl();
  }
}

export function frontendUrlFromRequest(request) {
  const hint = String(request?.query?.return || "").toLowerCase();
  if (hint === "dashboard") return spaOrigin(dashboardUrl());
  return siteUrl();
}

export function oauthReturnTo(request, cookieValue) {
  return spaOrigin(cookieValue || frontendUrlFromRequest(request));
}
