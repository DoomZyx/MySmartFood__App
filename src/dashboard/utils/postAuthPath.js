import { hasDashboardAccess } from "../API/auth";
import { DASHBOARD_PATH, dashboardHomeHref } from "@shared/dashboardPath";
import { PLATFORM_ADMIN_PATH } from "@shared/platformAdminPath";

const APP_PREFIXES = [
  "/app",
  DASHBOARD_PATH,
  "/orders",
  "/reservations",
  "/configuration",
  "/admin",
  "/profile",
];

function isAppPath(pathname) {
  return APP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function postAuthPath(session, from) {
  if (session?.isPlatformAdmin) return PLATFORM_ADMIN_PATH;
  const fallback = hasDashboardAccess(session) ? dashboardHomeHref() : "/mon-espace";
  if (!from || typeof from.pathname !== "string") return fallback;

  const pathname = from.pathname;
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return fallback;
  if (pathname === "/login" || pathname === "/register" || pathname === "/access") return fallback;
  if (!isAppPath(pathname)) return fallback;
  if (!hasDashboardAccess(session)) return "/mon-espace";
  return `${pathname}${from.search || ""}`;
}

export function followPostAuthPath(navigate, session, from) {
  const dest = postAuthPath(session, from);
  if (/^https?:\/\//i.test(dest)) {
    window.location.assign(dest);
    return;
  }
  navigate(dest, { replace: true });
}
