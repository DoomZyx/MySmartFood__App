import { useState } from "react";

import { apiBaseUrl } from "../services/apiBase";

const API_BASE_URL = apiBaseUrl();

/**
 * Appelle le backend pour créer une session Stripe Checkout et redirige vers l'URL renvoyée.
 * Le backend doit exposer POST /api/checkout/create-session avec body { planId } et retourner { url }.
 */
export const useCheckout = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const createCheckoutSession = async (planId) => {
    if (!API_BASE_URL) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/checkout/create-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Impossible de créer la session de paiement");
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("URL de paiement manquante");
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const startBetaAccess = async () => {
    if (!API_BASE_URL) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/checkout/start-beta`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || data.message || "Impossible d'activer l'accès beta");
      }
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  return {
    createCheckoutSession,
    startBetaAccess,
    isLoading,
    error,
    clearError,
  };
};
