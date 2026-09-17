import { PLATFORM_ADMIN_PATH } from "./platformAdminPath";
import { canOpenDashboard } from "./syncDashboardSession";
import { DASHBOARD_PATH, openDashboard } from "./dashboardPath";

export function isPlatformAdminUser(user) {
  return Boolean(user?.isPlatformAdmin);
}

export function followSiteAuthPath(navigate, user, loginIntent) {
  if (isPlatformAdminUser(user)) {
    navigate(PLATFORM_ADMIN_PATH, { replace: true });
    return;
  }

  if (loginIntent?.planId) {
    navigate(`/onboarding?planId=${loginIntent.planId}`, { replace: true });
    return;
  }

  const fromPath = loginIntent?.from?.pathname;
  if (
    canOpenDashboard(user) &&
    (fromPath?.startsWith("/app") || fromPath?.startsWith(DASHBOARD_PATH))
  ) {
    navigate(fromPath, { replace: true });
    return;
  }

  if (canOpenDashboard(user)) {
    openDashboard(navigate);
    return;
  }

  if (fromPath) {
    navigate(fromPath, { replace: true });
    return;
  }

  navigate("/mon-espace", { replace: true });
}
