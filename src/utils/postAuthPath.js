import { hasDashboardAccess } from "../API/auth";

const APP_PREFIXES = ["/app", "/orders", "/reservations", "/configuration", "/admin", "/profile"];

function isAppPath(pathname) {
  return APP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function postAuthPath(session, from) {
  const fallback = hasDashboardAccess(session) ? "/app" : "/mon-espace";
  if (!from || typeof from.pathname !== "string") return fallback;

  const pathname = from.pathname;
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return fallback;
  if (pathname === "/login" || pathname === "/register" || pathname === "/access") return fallback;
  if (!isAppPath(pathname)) return fallback;
  if (!hasDashboardAccess(session)) return "/mon-espace";
  return `${pathname}${from.search || ""}`;
}
