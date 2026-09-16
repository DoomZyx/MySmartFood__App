export function apiBaseUrl() {
  const raw = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "";
  return String(raw).replace(/\/+$/, "");
}

/** Chemin API absolu. Sans base, chemin racine (à éviter en SPA sans proxy). */
export function apiHref(path) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const base = apiBaseUrl();
  return base ? `${base}${suffix}` : suffix;
}
