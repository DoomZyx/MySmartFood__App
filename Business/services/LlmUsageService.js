import { withTenant } from "../../database/transaction.js";
import * as LlmUsage from "../../models/pg/LlmUsage.js";
import { resolveRuntimeTenantId } from "../../utils/runtimeTenant.js";
import { getActiveCalls } from "../../Services/streamRegistry.js";
import logger from "../../Services/logging/logger.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_SOURCES = new Set(["voice", "extraction"]);
const ALLOWED_PROVIDERS = new Set(["vllm", "openai"]);

function sanitizeLabel(value, max = 128) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^A-Za-z0-9_./:-]/g, "").slice(0, max);
  return cleaned || null;
}

function resolveTenantId(instanceId) {
  const tenantId = resolveRuntimeTenantId(instanceId);
  if (!UUID_PATTERN.test(String(tenantId || ""))) {
    throw new Error("Identifiant d'établissement invalide");
  }
  return tenantId;
}

function normalizeEvent(payload = {}) {
  const source = ALLOWED_SOURCES.has(payload.source) ? payload.source : "voice";
  const provider = ALLOWED_PROVIDERS.has(payload.provider)
    ? payload.provider
    : "vllm";
  return {
    source,
    provider,
    model: sanitizeLabel(payload.model, 160),
    inputTokens: payload.inputTokens,
    outputTokens: payload.outputTokens,
    totalTokens: payload.totalTokens,
    latencyMs: payload.latencyMs,
  };
}

export class LlmUsageService {
  static async record(instanceId, payload) {
    const tenantId = resolveTenantId(instanceId);
    const event = normalizeEvent(payload);
    if ((event.inputTokens || 0) + (event.outputTokens || 0) <= 0) {
      return null;
    }

    const row = await withTenant(tenantId, (client) =>
      LlmUsage.insert(client, tenantId, event)
    );

    logger.info(
      {
        tenantId,
        source: row.source,
        provider: row.provider,
        model: row.model,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        totalTokens: row.totalTokens,
        latencyMs: row.latencyMs,
      },
      "LLM usage instance"
    );

    return row;
  }

  static async recordFromStream(streamSid, payload) {
    const call = getActiveCalls().find((item) => item.streamSid === streamSid);
    if (!call?.instanceId) return null;
    return this.record(call.instanceId, payload);
  }

  static async listForTenant(tenantId, limit = 50) {
    const id = resolveTenantId(tenantId);
    return withTenant(id, async (client) => {
      const [events, totals] = await Promise.all([
        LlmUsage.listRecent(client, id, limit),
        LlmUsage.sumForTenant(client, id),
      ]);
      return { events, totals };
    });
  }
}
