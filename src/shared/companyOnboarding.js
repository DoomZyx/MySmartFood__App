const PAID_DOSSIER_KEY = "mysmartfood_paid_pending_dossier";

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function markPaidPendingDossier(userId) {
  const store = storage();
  if (!store) return;
  store.setItem(PAID_DOSSIER_KEY, String(userId || "1"));
}

export function clearPaidPendingDossier() {
  const store = storage();
  if (!store) return;
  store.removeItem(PAID_DOSSIER_KEY);
}

export function hasPaidPendingDossier(userId) {
  const store = storage();
  if (!store) return false;
  const raw = store.getItem(PAID_DOSSIER_KEY);
  if (!raw) return false;
  if (!userId) return true;
  return raw === String(userId) || raw === "1";
}

export function isDeveloperUser(user) {
  if (!user) return false;
  if (user.isPlatformOwner) return true;
  return String(user.planSlug || "").toLowerCase() === "developpeur";
}

export function stillNeedsPayment(user) {
  if (!user) return true;
  if (isDeveloperUser(user)) return false;
  if (user.accessUnlocked) return false;
  if (user.hasActiveSubscription) return false;
  if (user.onboardingStatus === "needs_dossier") return false;
  if (user.onboardingStatus === "pending_review") return false;
  if (hasPaidPendingDossier(user.id)) return false;
  return (
    user.onboardingStatus === "needs_payment" ||
    user.onboardingStatus === "none" ||
    !user.hasActiveSubscription
  );
}

export function canOpenCompanyDossierForm(user) {
  if (!user) return false;
  if (isDeveloperUser(user)) return true;
  return !user.twilioDocsSubmittedAt;
}

export function canResumeCompanyDossier(user) {
  if (!user) return false;
  if (isDeveloperUser(user)) return true;
  if (user.accessUnlocked) return false;
  if (user.twilioDocsSubmittedAt) return false;
  return Boolean(
    user.hasActiveSubscription ||
      user.onboardingStatus === "needs_dossier" ||
      user.smartcrmInstanceId ||
      user.planSlug ||
      hasPaidPendingDossier(user.id)
  );
}

export function shouldOpenMonEspace(user) {
  if (!user) return false;
  if (isDeveloperUser(user)) return false;
  if (user.accessUnlocked) return false;
  if (user.onboardingStatus === "pending_review") return true;
  if (user.onboardingStatus === "needs_payment" || user.onboardingStatus === "none") {
    return false;
  }
  return Boolean(
    user.hasActiveSubscription ||
      user.onboardingStatus === "needs_dossier" ||
      hasPaidPendingDossier(user.id)
  );
}
