/**
 * Clé API optionnelle pour les appels métier (standalone).
 * L'auth compte passe par le cookie de session du backend unifié.
 */
const STORAGE_KEY = "app_tenant_api_key";
const WEBSITE_USER_KEY = "app_website_user";

let memoryKey = null;

export function getApiKey() {
  return "";
}

export function setTenantApiKey(key) {
  if (key && typeof key === "string") {
    memoryKey = key;
    sessionStorage.setItem(STORAGE_KEY, key);
  }
}

export function clearTenantApiKey() {
  memoryKey = null;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function clearWebsiteUser() {
  sessionStorage.removeItem(WEBSITE_USER_KEY);
}
