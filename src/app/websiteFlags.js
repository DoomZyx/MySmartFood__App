import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import websiteCss from "@site/index.scss?url";
import { DASHBOARD_PATH, LEGACY_DASHBOARD_PATH } from "@shared/dashboardPath";

const DASHBOARD_ROUTE_PREFIXES = [
  DASHBOARD_PATH,
  LEGACY_DASHBOARD_PATH,
  "/app",
  "/profile",
  "/orders",
  "/reservations",
  "/configuration",
  "/monitoring",
  "/admin",
];

export function isDashboardPath(pathname) {
  return DASHBOARD_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function useWebsiteStyles() {
  const { pathname } = useLocation();
  const onDashboard = isDashboardPath(pathname);

  useLayoutEffect(() => {
    if (onDashboard) {
      document.querySelectorAll('link[data-theme="website"]').forEach((node) => node.remove());
      return undefined;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = websiteCss;
    link.dataset.theme = "website";
    document.head.appendChild(link);
    return () => link.remove();
  }, [onDashboard]);
}
