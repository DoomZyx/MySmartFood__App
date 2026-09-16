function trimUrl(value, fallback) {
  const raw = (value || fallback || "").trim();
  return raw.replace(/\/+$/, "");
}

export function siteUrl() {
  return trimUrl(process.env.SITE_URL, process.env.FRONTEND_URL || "https://www.mysmartfood.fr");
}

export function dashboardUrl() {
  return trimUrl(process.env.DASHBOARD_URL, "https://dashboard.mysmartfood.fr");
}

export function platformAdminPath() {
  const raw = String(process.env.PLATFORM_ADMIN_PATH || "/x/bXlzbWFydGZvb2QtcGxhdGZvcm0tYWRtaW4").trim();
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function frontendUrlFromRequest(request) {
  const hint = String(request?.query?.return || "").toLowerCase();
  if (hint === "dashboard") return dashboardUrl();
  const referer = String(request?.headers?.referer || "");
  if (referer.includes("dashboard.")) return dashboardUrl();
  return siteUrl();
}
