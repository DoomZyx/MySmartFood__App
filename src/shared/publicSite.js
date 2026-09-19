import { apiBaseUrl } from "./apiBase";
import { rewriteLegacyDashboardPath } from "./dashboardPath";

function trimOrigin(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function publicSiteOrigin() {
  const explicit = trimOrigin(import.meta.env.VITE_SITE_URL);
  if (explicit) return explicit;
  const api = apiBaseUrl();
  if (!api) return "";
  try {
    const url = new URL(api);
    const host = url.hostname;
    if (isLocalHost(host)) return "";
    if (host.startsWith("preprod.api.")) {
      return `${url.protocol}//${host.replace("preprod.api.", "preprod.")}`;
    }
    if (host.includes(".api.")) {
      const apex = host.replace(/^[^.]+\.api\./, "");
      return `${url.protocol}//www.${apex}`;
    }
  } catch {
    return "";
  }
  return "";
}

/** Si la SPA est servie sur l'hôte API, renvoyer vers le domaine vitrine. */
export function leaveApiHostHref() {
  if (typeof window === "undefined") return "";
  const pageHost = window.location.hostname;
  if (isLocalHost(pageHost)) return "";
  const api = apiBaseUrl();
  if (!api) return "";
  let apiHost = "";
  try {
    apiHost = new URL(api).hostname;
  } catch {
    return "";
  }
  if (!apiHost || pageHost !== apiHost) return "";
  const site = publicSiteOrigin();
  if (!site) return "";
  try {
    if (new URL(site).origin === window.location.origin) return "";
  } catch {
    return "";
  }
  const path = rewriteLegacyDashboardPath(window.location.pathname);
  return `${site}${path}${window.location.search}${window.location.hash}`;
}
