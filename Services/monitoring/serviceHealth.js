import { getVoiceServiceTargets } from "../../Config/voiceServiceTargets.js";

const DEFAULT_VOICE_MONITORING_URL = "http://127.0.0.1:8090/monitoring";
const DEFAULT_TIMEOUT_MS = 1000;

function normalizeHealthStatus(responseOk, payload) {
  if (!responseOk) return "unhealthy";

  const reportedStatus = String(payload?.status || "").toLowerCase();
  if (["unhealthy", "error", "failed"].includes(reportedStatus)) {
    return "unhealthy";
  }
  if (reportedStatus === "degraded" || payload?.engines?.ready === false) {
    return "degraded";
  }
  return "healthy";
}

function disabledService() {
  return {
    configured: false,
    status: "disabled",
    reachable: false,
  };
}

function sanitizeIdentifier(value) {
  if (value == null) return null;
  const sanitized = String(value).replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, 128);
  return sanitized || null;
}

function sanitizeActiveSessions(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map((session) => ({
    streamSid: sanitizeIdentifier(session?.streamSid),
    callSid: sanitizeIdentifier(session?.callSid),
    instanceId: sanitizeIdentifier(session?.instanceId),
    stage: sanitizeIdentifier(session?.stage) || "unknown",
    provider: sanitizeIdentifier(session?.provider),
    elapsedSeconds: Math.max(
      0,
      Number(session?.elapsedSeconds ?? session?.duration_seconds) || 0,
    ),
    lastError: sanitizeIdentifier(
      session?.lastError ?? session?.last_error,
    ),
  }));
}

const TELEMETRY_STAGES = ["node", "vad", "stt", "llm", "tts"];

function sanitizeLatencyRow(row) {
  if (!row || typeof row !== "object") return null;
  const count = Number(row.count);
  if (!Number.isFinite(count) || count <= 0) return null;
  const last = Number(row.last);
  const average = Number(row.average);
  const min = Number(row.min);
  const max = Number(row.max);
  return {
    count: Math.max(0, Math.floor(count)),
    last: Number.isFinite(last) ? Math.max(0, Math.round(last)) : 0,
    average: Number.isFinite(average) ? Math.max(0, Math.round(average)) : 0,
    min: Number.isFinite(min) ? Math.max(0, Math.round(min)) : 0,
    max: Number.isFinite(max) ? Math.max(0, Math.round(max)) : 0,
  };
}

function sanitizeTelemetry(payload) {
  const latency = payload?.telemetry?.latency_ms;
  if (!latency || typeof latency !== "object") return null;
  const latency_ms = {};
  for (const stage of TELEMETRY_STAGES) {
    const row = sanitizeLatencyRow(latency[stage]);
    if (row) latency_ms[stage] = row;
  }
  return Object.keys(latency_ms).length > 0 ? { latency_ms } : null;
}

/**
 * Sonde un endpoint de santé sans propager son indisponibilité au snapshot admin.
 */
export async function probeHealthService(
  url,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
    headers = {},
  } = {},
) {
  if (!url) {
    return {
      service: disabledService(),
      engines: null,
      components: null,
      activeSessions: [],
      llmProviderActive: null,
      telemetry: null,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    if (typeof fetchImpl !== "function") {
      throw new Error("fetch unavailable");
    }
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers,
    });
    const payload = await response.json().catch(() => null);
    const activeCalls = Number(
      payload?.activeCalls ?? payload?.sessions_active,
    );
    const service = {
      configured: true,
      status: normalizeHealthStatus(response.ok, payload),
      reachable: true,
      httpStatus: response.status,
      latencyMs: Date.now() - startedAt,
    };

    if (Number.isFinite(activeCalls) && activeCalls >= 0) {
      service.activeCalls = Math.floor(activeCalls);
    }
    const reportedError =
      payload?.error ??
      payload?.detail ??
      payload?.engines?.error ??
      payload?.message;
    if (typeof reportedError === "string" && reportedError.trim()) {
      service.message = reportedError.trim();
    }

    return {
      service,
      engines:
        payload?.engines && typeof payload.engines === "object"
          ? payload.engines
          : null,
      components:
        payload?.components && typeof payload.components === "object"
          ? payload.components
          : null,
      activeSessions: sanitizeActiveSessions(payload?.active_sessions),
      llmProviderActive: sanitizeIdentifier(payload?.llm_provider_active),
      telemetry: sanitizeTelemetry(payload),
    };
  } catch (error) {
    return {
      service: {
        configured: true,
        status: "unhealthy",
        reachable: false,
        latencyMs: Date.now() - startedAt,
        error: error?.name === "AbortError" ? "timeout" : "unreachable",
      },
      engines: null,
      components: null,
      activeSessions: [],
      llmProviderActive: null,
      telemetry: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

function aggregateVoiceServerHealth(results) {
  const healthyResults = results.filter(
    (result) => result.service.status === "healthy",
  );
  const reachableResults = results.filter(
    (result) => result.service.reachable,
  );
  const representative =
    healthyResults[0] || reachableResults[0] || results[0];
  const allHealthy =
    results.length > 0 && healthyResults.length === results.length;
  const usingOpenAiFallback = results.some(
    (result) => result.llmProviderActive === "openai",
  );
  const status =
    reachableResults.length > 0 && (allHealthy || usingOpenAiFallback)
      ? "healthy"
      : healthyResults.length > 0
        ? "degraded"
        : "unhealthy";
  let message = null;
  if (usingOpenAiFallback) {
    message = "openai-fallback-active";
  } else if (!allHealthy && healthyResults.length > 0) {
    message = "voice-server-pool-partially-unavailable";
  } else if (!allHealthy) {
    message = "voice-server-pool-unavailable";
  }

  return {
    service: {
      configured: true,
      status,
      reachable: reachableResults.length > 0,
      targetCount: results.length,
      healthyTargets: healthyResults.length,
      activeCalls: results.reduce(
        (total, result) => total + (result.service.activeCalls || 0),
        0,
      ),
      latencyMs: Math.max(
        0,
        ...results.map((result) => result.service.latencyMs || 0),
      ),
      ...(message ? { message } : {}),
    },
    engines: representative?.engines || null,
    components: representative?.components || null,
    activeSessions: results.flatMap((result) => result.activeSessions || []),
    llmProviderActive:
      usingOpenAiFallback
        ? "openai"
        : representative?.llmProviderActive || null,
    telemetry: representative?.telemetry || null,
  };
}

function resolveGatewayHealthUrl() {
  const explicit = String(process.env.GATEWAY_HEALTH_URL || "").trim();
  if (explicit) {
    return { url: explicit, explicit: true };
  }
  const port = String(process.env.GATEWAY_PORT || "3001").trim() || "3001";
  return { url: `http://127.0.0.1:${port}/health`, explicit: false };
}

function resolveFallbackApiUrl() {
  const base = String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1")
    .trim()
    .replace(/\/$/, "");
  const model =
    String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini";
  return `${base}/models/${encodeURIComponent(model)}`;
}

function discardResponseBody(response) {
  const body = response?.body;
  if (body && typeof body.cancel === "function") {
    Promise.resolve(body.cancel()).catch(() => {});
  }
}

/**
 * TTFB HTTPS froid = TCP + TLS 1.3 + HTTP (3 allers-retours).
 * RTT reseau ≈ TTFB / 3.
 */
export function estimateNetworkRttMs(httpsTtfbMs) {
  const ttfb = Number(httpsTtfbMs);
  if (!Number.isFinite(ttfb) || ttfb < 0) return null;
  return Math.max(0, Math.round(ttfb / 3));
}

/**
 * Mesure le temps jusqu'aux en-tetes d'un GET leger (un modele), pas le catalogue /v1/models.
 */
export async function probeFallbackApi({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return { configured: false, reachable: false, latencyMs: null };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    if (typeof fetchImpl !== "function") {
      throw new Error("fetch unavailable");
    }
    const response = await fetchImpl(resolveFallbackApiUrl(), {
      method: "GET",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const latencyMs = estimateNetworkRttMs(Date.now() - startedAt);
    discardResponseBody(response);
    return {
      configured: true,
      reachable: response.ok || response.status === 401,
      latencyMs,
    };
  } catch {
    return {
      configured: true,
      reachable: false,
      latencyMs: estimateNetworkRttMs(Date.now() - startedAt),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getExternalHealthSnapshot(options = {}) {
  const voiceTargets = getVoiceServiceTargets();
  const voiceUrls =
    voiceTargets.length > 0
      ? voiceTargets.map((target) => target.monitoringUrl)
      : [DEFAULT_VOICE_MONITORING_URL];
  const gatewayTarget = resolveGatewayHealthUrl();
  const voiceProbeOptions = {
    ...options,
    headers: {
      ...options.headers,
      "x-api-key": process.env.X_API_KEY || "",
    },
  };

  const [voiceResults, gatewayProbe, fallbackApi] = await Promise.all([
    Promise.all(
      voiceUrls.map((voiceUrl) =>
        probeHealthService(voiceUrl, voiceProbeOptions),
      ),
    ),
    probeHealthService(gatewayTarget.url, options),
    probeFallbackApi(options),
  ]);

  const gateway =
    !gatewayTarget.explicit && !gatewayProbe.service.reachable
      ? { service: disabledService(), engines: null }
      : gatewayProbe;

  const voiceServer = aggregateVoiceServerHealth(voiceResults);
  return { voiceServer, gateway, fallbackApi };
}
