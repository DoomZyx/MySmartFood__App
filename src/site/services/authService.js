/**
 * Service d'authentification OAuth Google.
 * Le token est géré côté backend via cookie HttpOnly : il n'apparaît jamais en frontend.
 * Les URLs sont en placeholder tant que le backend n'est pas prêt.
 */

import { apiBaseUrl, apiHref } from "./apiBase";

function requireApiBase() {
  const base = apiBaseUrl();
  if (!base) {
    throw new Error("API non configurée (VITE_API_BASE_URL).");
  }
  return base;
}

const API_BASE_URL = apiBaseUrl();

/**
 * Redirige l'utilisateur vers l'endpoint backend qui lance le flow OAuth Google.
 * Le backend renverra une redirect vers Google, puis après auth définira un cookie
 * HttpOnly (token) et redirigera vers l'URL de callback du frontend (sans token dans l'URL).
 */
export const loginWithGoogle = () => {
  const base = requireApiBase();
  window.location.assign(`${base}/api/auth/google?return=site`);
};

export const getGoogleLoginUrl = () => {
  if (!apiBaseUrl()) return null;
  return apiHref("/api/auth/google?return=site");
};

export const resendAccessEmailApi = async () => {
  if (!API_BASE_URL) throw new Error("API non configurée.");
  const response = await fetch(`${API_BASE_URL}/api/auth/resend-access`, {
    method: "POST",
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || "Impossible d'envoyer le lien");
  }
  return data;
};

/**
 * Inscription avec email et mot de passe. Crée le compte et définit le cookie.
 * @returns {Promise<{ id, email, name, ... }>}
 */
export const registerApi = async (email, password) => {
  if (!API_BASE_URL) throw new Error("API non configurée.");
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      email: (email || "").trim().toLowerCase(),
      password: password || "",
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Inscription impossible.");
  }
  const data = await response.json();
  return data.user ?? data;
};

/**
 * Connexion avec email et mot de passe. Définit le cookie côté backend.
 * @returns {Promise<{ id, email, name, ... } | null>} Utilisateur ou null en cas d'échec
 */
export const loginWithEmailPassword = async (email, password) => {
  if (!API_BASE_URL) return null;
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: (email || "").trim(),
        password: password || "",
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Connexion impossible.");
    }
    const data = await response.json();
    return data.user ?? data;
  } catch (err) {
    throw err;
  }
};

/**
 * Définit le mot de passe de l'utilisateur connecté (après OAuth ou avant checkout).
 * @param {string} password Mot de passe (min. 8 caractères)
 */
export const setPasswordApi = async (password) => {
  if (!API_BASE_URL) throw new Error("API non configurée.");
  const response = await fetch(`${API_BASE_URL}/api/auth/set-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password: (password || "").trim() }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Impossible de définir le mot de passe.");
  }
};

/**
 * Récupère l'utilisateur courant via le cookie HttpOnly.
 * Le backend lit le cookie (token) et renvoie uniquement les infos user (jamais le token).
 * Retourne null si non authentifié (401, etc.), rejette en cas d'erreur réseau pour permettre au caller de logger.
 * @returns {Promise<{ id, email, name, picture?, ... } | null>}
 */
export const getCurrentUser = async () => {
  if (!API_BASE_URL) return null;
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: "GET",
      credentials: "include",
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.user ?? data;
  } catch (err) {
    return Promise.reject(err);
  }
};

/**
 * Transmet le dossier Twilio (coordonnées + pièces) depuis Mon espace. Pas de création d'instance automatique.
 * @param {Object} formData - champs profil dont twilioNumberUsage et siret/siren
 * @param {{ idDocumentRecto: File, idDocumentVerso: File, addressDocument: File }} files
 */
export const submitOnboardingDossierApi = async (formData, files) => {
  if (!API_BASE_URL) throw new Error("API non configurée.");
  const { idDocumentRecto, idDocumentVerso, addressDocument } = files || {};
  if (!idDocumentRecto || !idDocumentVerso || !addressDocument) {
    throw new Error(
      "Documents requis : pièce d'identité recto et verso, justificatif d'adresse.",
    );
  }
  const body = new FormData();
  Object.keys(formData).forEach((key) => {
    if (formData[key] != null && formData[key] !== "") body.append(key, formData[key]);
  });
  body.append("idDocumentRecto", idDocumentRecto);
  body.append("idDocumentVerso", idDocumentVerso);
  body.append("addressDocument", addressDocument);
  const response = await fetch(`${API_BASE_URL}/api/auth/profile/submit-onboarding`, {
    method: "POST",
    credentials: "include",
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Impossible d'envoyer le dossier.");
  }
  return data;
};

/**
 * Déconnexion : demande au backend d'invalider / supprimer le cookie.
 * À appeler avec credentials: 'include' pour envoyer le cookie à invalider.
 */
export const logoutApi = async () => {
  if (!API_BASE_URL) return;
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // ignore
  }
};
