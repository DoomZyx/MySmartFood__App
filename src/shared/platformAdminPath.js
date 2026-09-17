const DEFAULT_PATH = "/bf-admin";
const LEGACY_PATH = "/x/bXlzbWFydGZvb2QtcGxhdGZvcm0tYWRtaW4";

function normalizePath(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return DEFAULT_PATH;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export const PLATFORM_ADMIN_PATH = normalizePath(
  import.meta.env.VITE_PLATFORM_ADMIN_PATH || DEFAULT_PATH
);

export const PLATFORM_ADMIN_ALIASES = [
  ...new Set([PLATFORM_ADMIN_PATH, DEFAULT_PATH, LEGACY_PATH]),
];

export function isPlatformAdminPath(pathname) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  const lower = path.toLowerCase();
  if (lower === "/bf-admin" || lower.endsWith("/bf-admin")) return true;
  return PLATFORM_ADMIN_ALIASES.includes(path) || path.startsWith("/x/");
}
