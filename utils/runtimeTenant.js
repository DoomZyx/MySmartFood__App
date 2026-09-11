const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseTenantMap(raw = process.env.TENANT_MAP || "") {
  const map = new Map();
  for (const pair of raw.split(",").map((item) => item.trim()).filter(Boolean)) {
    const [from, to] = pair.split(":");
    if (from && to) map.set(from.trim(), to.trim());
  }
  return map;
}

/**
 * Identifiant tenant Postgres pour la voix et les tools internes.
 * INSTANCE_ID (UUID) prioritaire, sinon TENANT_MAP (ex. inst_default:<uuid>).
 */
export function resolveRuntimeTenantId(instanceId) {
  const raw = String(
    instanceId != null && String(instanceId).trim() !== ""
      ? instanceId
      : process.env.INSTANCE_ID || "inst_default"
  ).trim();
  if (UUID_PATTERN.test(raw)) return raw;
  const mapped = parseTenantMap().get(raw);
  if (mapped && UUID_PATTERN.test(mapped)) return mapped;
  return raw;
}
