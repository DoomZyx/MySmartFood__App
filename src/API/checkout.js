import { apiFetch } from "./http.js";

export async function fetchPlans() {
  const res = await apiFetch("api/checkout/plans");
  if (!res.ok) {
    throw new Error("Impossible de charger les offres");
  }
  const data = await res.json();
  return data.plans || [];
}

export async function createCheckoutSession({ planSlug, planId } = {}) {
  const res = await apiFetch("api/checkout/create-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planSlug, planId }),
  });

  if (res.status === 401) {
    const error = new Error("Connectez-vous pour souscrire");
    error.code = "UNAUTHENTICATED";
    throw error;
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || payload.message || "Paiement impossible");
  }

  return res.json();
}
