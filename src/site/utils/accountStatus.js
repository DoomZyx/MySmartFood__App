import { isDeveloperUser, stillNeedsPayment } from "@shared/companyOnboarding";

function isBetaPlan(user) {
  const slug = String(user?.planSlug || "").toLowerCase();
  const name = String(user?.planName || "");
  const planId = Number(user?.planId);
  return slug === "beta" || planId === 6 || /beta/i.test(name);
}

export function getAccountStatus(user) {
  if (!user) {
    return {
      id: "visitor",
      label: "Visiteur",
      detail: "Connectez-vous pour suivre votre parcours beta.",
    };
  }

  if (isDeveloperUser(user)) {
    return {
      id: "developer",
      label: "Développeur",
      detail: "Accès ouvert, sans paiement ni validation de dossier.",
    };
  }

  const planName = String(user.planName || "").trim();
  const beta = isBetaPlan(user);
  const paid = !stillNeedsPayment(user);
  const pendingReview =
    user.onboardingStatus === "pending_review" || Boolean(user.twilioDocsSubmittedAt);

  if (user.accessUnlocked) {
    return {
      id: beta || !planName ? "beta-active" : "client",
      label: beta || !planName ? "Beta testeur" : planName,
      detail: "Accès au tableau de bord ouvert.",
    };
  }

  if (paid && pendingReview) {
    return {
      id: "beta-review",
      label: "Beta testeur",
      detail: "Dossier en cours de validation.",
    };
  }

  if (paid) {
    return {
      id: "beta-setup",
      label: "Payé",
      detail: "Tout est réglé. Il reste le formulaire d'entreprise.",
    };
  }

  return {
    id: "visitor",
    label: "Visiteur",
    detail: "Paiement de la beta à effectuer.",
  };
}
