import { getCurrentUser, hasDashboardAccess, isAuthenticated } from "../../API/auth";

export function useSiteNav() {
  const user = getCurrentUser();
  return {
    isLoggedIn: isAuthenticated(),
    hasDashboard: hasDashboardAccess(),
    displayName: user?.name || user?.username || user?.email || "",
  };
}
