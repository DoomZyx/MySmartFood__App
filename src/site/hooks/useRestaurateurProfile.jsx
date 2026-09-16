import { useState, useCallback } from "react";
import { submitOnboardingDossierApi } from "../services/authService";

import { apiBaseUrl } from "../services/apiBase";

const API_BASE_URL = apiBaseUrl();

/**
 * Hook pour le profil restaurateur : chargement et soumission.
 * Utilise le cookie HttpOnly (credentials: 'include').
 */
export const useRestaurateurProfile = () => {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [onboardingError, setOnboardingError] = useState(null);
  const [isSubmittingOnboarding, setIsSubmittingOnboarding] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!API_BASE_URL) return null;
    setIsLoadingProfile(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) return null;
      const data = await response.json();
      setProfile(data && Object.keys(data).length ? data : null);
      return data;
    } catch {
      return null;
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  const submitProfile = async (formData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Erreur lors de l'enregistrement");
      }
      setProfile(data);
      setSuccess(true);
      return { ok: true, profile: data };
    } catch (err) {
      setError(err.message || "Erreur lors de l'enregistrement");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = useCallback(() => {
    setError(null);
    setSuccess(false);
    setOnboardingError(null);
  }, []);

  const submitOnboardingDossier = async (formData, files) => {
    setIsSubmittingOnboarding(true);
    setOnboardingError(null);
    try {
      const data = await submitOnboardingDossierApi(formData, files);
      if (data.profile) setProfile(data.profile);
      return data;
    } catch (err) {
      setOnboardingError(err.message || "Erreur lors de l'envoi du dossier");
      throw err;
    } finally {
      setIsSubmittingOnboarding(false);
    }
  };

  return {
    profile,
    loadProfile,
    submitProfile,
    submitOnboardingDossier,
    isLoading,
    isLoadingProfile,
    isSubmittingOnboarding,
    error,
    success,
    onboardingError,
    resetForm,
  };
};
