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
    return { service: disabledService(), engines: null };
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
  const status = allHealthy && !usingOpenAiFallback
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
  };
}

export async function getExternalHealthSnapshot(options = {}) {
  const voiceTargets = getVoiceServiceTargets();
  const voiceUrls =
    voiceTargets.length > 0
      ? voiceTargets.map((target) => target.monitoringUrl)
      : [DEFAULT_VOICE_MONITORING_URL];
  const gatewayUrl = String(process.env.GATEWAY_HEALTH_URL || "").trim();
  const voiceProbeOptions = {
    ...options,
    headers: {
      ...options.headers,
      "x-api-key": process.env.X_API_KEY || "",
    },
  };

  const [voiceResults, gateway] = await Promise.all([
    Promise.all(
      voiceUrls.map((voiceUrl) =>
        probeHealthService(voiceUrl, voiceProbeOptions),
      ),
    ),
    gatewayUrl
      ? probeHealthService(gatewayUrl, options)
      : Promise.resolve({ service: disabledService(), engines: null }),
  ]);

  const voiceServer = aggregateVoiceServerHealth(voiceResults);
  return { voiceServer, gateway };
}
