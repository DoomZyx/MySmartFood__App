import { getApiKey, clearTenantApiKey, clearWebsiteUser } from "./apiKey.js";
import { apiFetch, clearSession, persistSession, sessionHeaders } from "./http.js";
const VITE_API_URL = import.meta.env.VITE_API_URL;

// Connexion utilisateur
export async function loginUser(email, password) {
  const res = await apiFetch("api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Erreur de connexion");
  }

  const data = await res.json();
  persistSession(data);
  return data;
}

export async function registerUser({ email, password, name }) {
  const res = await apiFetch("api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.message || "Erreur d'inscription");
  }

  const data = await res.json();
  persistSession(data);
  return data;
}

export async function redeemAccessToken(token) {
  const res = await apiFetch("api/auth/redeem-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.message || "Jeton invalide");
  }

  const data = await res.json();
  persistSession(data);
  return data;
}

export async function resendAccessEmail() {
  const res = await apiFetch("api/auth/resend-access", { method: "POST" });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.message || "Impossible d'envoyer le lien");
  }
  return res.json();
}

export async function fetchSession() {
  const res = await apiFetch("api/auth/me");
  if (!res.ok) {
    if (res.status === 401) clearSession();
    return null;
  }
  const data = await res.json();
  persistSession(data);
  return data;
}

// Déconnexion utilisateur (app + session website si présente)
export function logoutUser() {
  apiFetch("api/auth/logout", { method: "POST" }).catch(() => {});
  clearSession();
  clearWebsiteUser();
  clearTenantApiKey();
  localStorage.removeItem("smartcrm_user");
}

// Obtenir le token stocké
export function getToken() {
  return localStorage.getItem("token");
}

export function getCurrentUser() {
  const user = localStorage.getItem("user");
  if (!user) return null;
  try {
    return JSON.parse(user);
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getCurrentUser()?.email);
}

// Vérifier si l'utilisateur est admin
export function isAdmin() {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.isPlatformAdmin || user.role === "admin" || user.role === "owner") return true;
  return false;
}

export function hasDashboardAccess(session) {
  const user = session?.user || session || getCurrentUser();
  if (!user) return false;
  if (user.isPlatformAdmin || user.role === "admin") return true;
  return Boolean(user.hasActiveSubscription && user.accessUnlocked);
}

function requireAuth() {
  if (!getCurrentUser()?.email) {
    throw new Error("Non authentifié");
  }
}

function getAuthHeaders(extra = {}) {
  return sessionHeaders(extra);
}

async function authJson(path, options = {}) {
  const res = await apiFetch(path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.hint
      ? `${err.error || "Erreur"}. ${err.hint}`
      : err.error || err.message || "Erreur";
    throw new Error(msg);
  }
  return res.json();
}

export async function getProfile() {
  return authJson("api/auth/account");
}

export async function updateUserProfile(profileData) {
  return authJson("api/auth/account", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profileData),
  });
}

export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append("avatar", file);
  return authJson("api/auth/account/avatar", {
    method: "POST",
    body: formData,
  });
}

// Créer un nouvel utilisateur (admin seulement)
export async function createUser(userData) {
  return authJson("api/auth/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });
}

// Lister tous les utilisateurs (admin seulement)
export async function getAllUsers() {
  return authJson("api/auth/users");
}

// Modifier un utilisateur (admin seulement)
export async function updateUser(id, userData) {
  return authJson(`api/auth/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });
}

// Supprimer un utilisateur (admin seulement)
export async function deleteUser(id) {
  return authJson(`api/auth/users/${id}`, {
    method: "DELETE",
  });
}

// Récupérer les statistiques système (admin seulement)
export async function getSystemStats() {
  requireAuth();

  const res = await fetch(`${VITE_API_URL}api/auth/stats`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(
      error.error || "Erreur lors de la récupération des statistiques"
    );
  }

  return res.json();
}

// Récupérer les logs système (admin seulement)
export async function getSystemLogs(type = "all", limit = 50) {
  requireAuth();

  const params = new URLSearchParams();
  if (type !== "all") params.append("type", type);
  params.append("limit", limit);

  const res = await fetch(`${VITE_API_URL}api/auth/logs?${params}`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erreur lors de la récupération des logs");
  }

  return res.json();
}

// Récupérer les statistiques de maintenance (admin seulement)
export async function getMaintenanceStats() {
  const res = await apiFetch("api/auth/maintenance/stats");

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erreur lors de la récupération des statistiques de maintenance");
  }

  return res.json();
}
