/** Aligne le localStorage dashboard avec la session vitrine (même cookie). */
export function syncDashboardSession(user) {
  if (!user) {
    localStorage.removeItem("user");
    localStorage.removeItem("tenantId");
    return;
  }
  const tenantId =
    user.smartcrmInstanceId ||
    user.tenants?.find((item) => item.status === "active")?.id ||
    user.tenants?.[0]?.id ||
    "";
  localStorage.setItem(
    "user",
    JSON.stringify({
      id: user.id,
      email: user.email || "",
      name: user.name || user.email || "",
      username: user.name || user.email || "",
      avatar: user.avatarUrl || user.avatar || null,
      role:
        user.isPlatformAdmin || user.role === "admin" || user.role === "owner" || user.appRole === "admin"
          ? "admin"
          : "user",
      isPlatformAdmin: Boolean(user.isPlatformAdmin),
      isPlatformOwner: Boolean(user.isPlatformOwner),
      planId: user.planId || null,
      planSlug: user.planSlug || null,
      planName: user.planName || null,
      hasActiveSubscription: Boolean(user.hasActiveSubscription),
      accessUnlocked: Boolean(user.accessUnlocked),
      smartcrmInstanceId: tenantId || null,
    })
  );
  if (tenantId) localStorage.setItem("tenantId", tenantId);
  localStorage.removeItem("token");
}

export function canOpenDashboard(user) {
  return Boolean(user?.accessUnlocked);
}
