/**
 * Cache court du contexte vocal (menu / horaires) pour GET /api/voice/context.
 * TTL 45s ; invalidation explicite sur écritures menu / horaires / amenities.
 */

const DEFAULT_TTL_MS = 45_000;

/** @type {Map<string, { expiresAt: number, value: unknown }>} */
const store = new Map();

export function getVoiceContextCacheTtlMs() {
  const raw = Number(process.env.VOICE_CONTEXT_CACHE_TTL_MS);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return DEFAULT_TTL_MS;
}

export function getCachedVoiceContext(tenantId) {
  const key = String(tenantId || "").trim();
  if (!key) return null;
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedVoiceContext(tenantId, value, ttlMs = getVoiceContextCacheTtlMs()) {
  const key = String(tenantId || "").trim();
  if (!key || value == null) return;
  if (ttlMs <= 0) {
    store.delete(key);
    return;
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateVoiceContextCache(tenantId) {
  const key = String(tenantId || "").trim();
  if (!key) return;
  store.delete(key);
}

/** Tests uniquement. */
export function clearVoiceContextCache() {
  store.clear();
}
