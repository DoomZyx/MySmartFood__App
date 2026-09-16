const DEFAULT_ENCODED = "bXlzbWFydGZvb2QtcGxhdGZvcm0tYWRtaW4";

function normalizePath(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return `/x/${DEFAULT_ENCODED}`;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export const PLATFORM_ADMIN_PATH = normalizePath(
  import.meta.env.VITE_PLATFORM_ADMIN_PATH
);
