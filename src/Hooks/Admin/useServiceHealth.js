import { useCallback, useEffect, useRef, useState } from "react";
import { getMonitoring } from "../../Services/monitoringService";

const POLLING_INTERVAL_MS = 5000;
const STALE_AFTER_MS = POLLING_INTERVAL_MS * 2;

const SERVICE_DEFINITIONS = [
  { key: "backend", aliases: ["backend", "api"] },
  { key: "mongo", aliases: ["mongo", "mongodb", "database", "db"] },
  { key: "gateway", aliases: ["gateway", "voiceGateway"] },
  { key: "voice", aliases: ["voice", "voiceServer", "voiceService"] },
  { key: "stt", aliases: ["stt", "speechToText", "speech_to_text"] },
  { key: "llm", aliases: ["llm", "languageModel", "language_model"] },
  { key: "tts", aliases: ["tts", "textToSpeech", "text_to_speech"] },
];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function asText(value, fallback = null) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const timestamp =
    typeof value === "number" && value > 0 && value < 1_000_000_000_000
      ? value * 1000
      : value;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeStatus(value) {
  const rawValue = isRecord(value)
    ? firstDefined(value.status, value.state, value.health, value.ok, value.healthy)
    : value;

  if (rawValue === true) return "healthy";
  if (rawValue === false) return "down";
  if (typeof rawValue !== "string") return "unknown";

  const status = rawValue.trim().toLowerCase();
  if (
    ["ok", "up", "ready", "online", "healthy", "connected", "operational", "success"].includes(
      status,
    )
  ) {
    return "healthy";
  }
  if (
    ["degraded", "warning", "warn", "partial", "fallback", "pending", "slow"].includes(
      status,
    )
  ) {
    return "degraded";
  }
  if (
    [
      "down",
      "error",
      "failed",
      "failure",
      "offline",
      "unhealthy",
      "disconnected",
      "unavailable",
      "critical",
      "fatal",
    ].includes(status)
  ) {
    return "down";
  }
  return "unknown";
}

function findServiceSource(root, aliases) {
  const containers = [
    root.services,
    root.engines,
    root.dependencies,
    root.components,
    root.health,
    root.checks,
    root,
  ].filter(isRecord);

  for (const container of containers) {
    for (const alias of aliases) {
      if (container[alias] !== undefined) return container[alias];
    }
  }
  return null;
}

function normalizeService(root, definition) {
  const source = findServiceSource(root, definition.aliases);
  const details = isRecord(source) ? source : {};
  const status = normalizeStatus(source);
  const latencyMs = asNumber(
    firstDefined(
      details.latencyMs,
      details.latency_ms,
      details.latency,
      details.responseTimeMs,
      details.response_time_ms,
      details.responseTime,
    ),
  );

  return {
    key: definition.key,
    status,
    latencyMs,
    provider: asText(firstDefined(details.provider, details.vendor, details.engine)),
    model: asText(firstDefined(details.model, details.modelName, details.model_name)),
    message: asText(
      firstDefined(details.message, details.detail, details.reason, details.error),
    ),
    hasData:
      source !== null &&
      (status !== "unknown" ||
        latencyMs !== null ||
        Boolean(
          firstDefined(
            details.provider,
            details.vendor,
            details.engine,
            details.model,
            details.message,
            details.detail,
            details.reason,
            details.error,
          ),
        )),
    source: details,
  };
}

function normalizeDurationMs(call, now) {
  const durationMs = asNumber(firstDefined(call.durationMs, call.duration_ms));
  if (durationMs !== null) return Math.max(0, durationMs);

  const durationSeconds = asNumber(
    firstDefined(call.durationSeconds, call.duration_seconds, call.duration),
  );
  if (durationSeconds !== null) return Math.max(0, durationSeconds * 1000);

  const startedAt = asDate(
    firstDefined(call.startedAt, call.started_at, call.startTime, call.start_time),
  );
  return startedAt ? Math.max(0, now - new Date(startedAt).getTime()) : null;
}

function normalizeCalls(root, now) {
  const callsContainer = isRecord(root.calls) ? root.calls : {};
  const source = firstDefined(
    root.activeCalls,
    root.active_calls,
    root.runtime?.activeCalls,
    root.runtime?.active_calls,
    callsContainer.active,
    root.voice?.activeCalls,
    root.voice?.active_calls,
    [],
  );
  const calls = Array.isArray(source)
    ? source
    : isRecord(source)
      ? Object.entries(source).map(([id, call]) =>
          isRecord(call) ? { id, ...call } : { id },
        )
      : [];

  return calls.map((call, index) => {
    const details = isRecord(call) ? call : {};
    return {
      id:
        asText(
          firstDefined(
            details.id,
            details.callId,
            details.call_id,
            details.callSid,
            details.call_sid,
            details.streamSid,
            details.stream_sid,
            details.sessionId,
            details.session_id,
          ),
        ) || `call-${index + 1}`,
      route: asText(
        firstDefined(details.route, details.path, details.direction, details.callRoute),
      ),
      step: asText(
        firstDefined(details.step, details.stage, details.currentStep, details.current_step),
      ),
      provider: asText(
        firstDefined(details.provider, details.llmProvider, details.llm_provider),
      ),
      lastError: asText(
        firstDefined(details.lastError, details.last_error, details.error),
      ),
      durationMs: normalizeDurationMs(details, now),
    };
  });
}

function normalizeAlerts(root) {
  const alertsContainer = isRecord(root.alerts) ? root.alerts : {};
  const source = firstDefined(
    root.recentAlerts,
    root.recent_alerts,
    alertsContainer.recent,
    Array.isArray(root.alerts) ? root.alerts : undefined,
    [],
  );
  const alerts = Array.isArray(source)
    ? source
    : isRecord(source)
      ? Object.entries(source).map(([id, alert]) =>
          isRecord(alert) ? { id, ...alert } : { id, message: alert },
        )
      : [];

  return alerts.map((alert, index) => {
    const details = isRecord(alert) ? alert : {};
    const message = isRecord(alert)
      ? asText(firstDefined(details.message, details.detail, details.title, details.error))
      : asText(alert);

    return {
      id:
        asText(firstDefined(details.id, details.alertId, details.alert_id)) ||
        `alert-${index + 1}`,
      severity: normalizeStatus(
        firstDefined(details.severity, details.level, details.status, "warning"),
      ),
      service: asText(firstDefined(details.service, details.component, details.source)),
      message,
      timestamp: asDate(
        firstDefined(
          details.timestamp,
          details.createdAt,
          details.created_at,
          details.date,
        ),
      ),
    };
  });
}

function deriveGlobalStatus(services) {
  const statuses = services.map((service) => service.status);
  if (statuses.includes("down")) return "down";
  if (statuses.includes("degraded")) return "degraded";
  if (statuses.includes("healthy")) return "healthy";
  return "unknown";
}

function normalizeFallbackOpenAI(root, llmService) {
  const fallback = firstDefined(
    root.fallbackOpenAI,
    root.fallback_openai,
    root.openaiFallback,
    root.openai_fallback,
    root.fallback?.openai,
    llmService.source.fallbackOpenAI,
    llmService.source.fallback_openai,
    llmService.source.fallbackActive,
    llmService.source.fallback_active,
    llmService.source.usingFallback,
    llmService.source.using_fallback,
  );

  if (typeof fallback === "boolean") return fallback;
  if (typeof fallback === "string") {
    return ["true", "active", "enabled", "openai"].includes(fallback.toLowerCase());
  }
  return false;
}

function normalizeMonitoringPayload(payload, fetchedAt) {
  const envelope = isRecord(payload) ? payload : {};
  const data = isRecord(envelope.data) ? envelope.data : envelope;
  const root = isRecord(data.monitoring)
    ? data.monitoring
    : isRecord(envelope.monitoring)
      ? envelope.monitoring
      : data;
  const services = SERVICE_DEFINITIONS.map((definition) =>
    normalizeService(root, definition),
  );
  const activeCalls = normalizeCalls(root, fetchedAt);
  const alerts = normalizeAlerts(root);
  const explicitGlobalStatus = normalizeStatus(
    firstDefined(root.overallStatus, root.overall_status, root.status, root.health),
  );
  const serverUpdatedAt = asDate(
    firstDefined(
      root.updatedAt,
      root.updated_at,
      root.generatedAt,
      root.generated_at,
      root.timestamp,
      envelope.timestamp,
    ),
  );
  const llmService = services.find((service) => service.key === "llm");
  const fallbackOpenAI = normalizeFallbackOpenAI(root, llmService);
  const sourceStale = firstDefined(root.stale, root.isStale, root.is_stale) === true;
  const hasData =
    explicitGlobalStatus !== "unknown" ||
    services.some((service) => service.hasData) ||
    activeCalls.length > 0 ||
    alerts.length > 0 ||
    fallbackOpenAI ||
    Boolean(serverUpdatedAt);

  return {
    globalStatus:
      explicitGlobalStatus === "unknown"
        ? deriveGlobalStatus(services)
        : explicitGlobalStatus,
    services: services.map(({ source, hasData: serviceHasData, ...service }) => ({
      ...service,
      hasData: serviceHasData,
    })),
    activeCalls,
    alerts,
    fallbackOpenAI,
    serverUpdatedAt,
    sourceStale,
    empty: !hasData,
  };
}

export function useServiceHealth() {
  const [monitoring, setMonitoring] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const abortControllerRef = useRef(null);
  const requestInFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (requestInFlightRef.current) return;

    requestInFlightRef.current = true;
    setRefreshing(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const payload = await getMonitoring({ signal: controller.signal });
      const fetchedAt = Date.now();
      setMonitoring(normalizeMonitoringPayload(payload, fetchedAt));
      setLastUpdatedAt(fetchedAt);
      setError(null);
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(requestError.message || "monitoring.errors.fetchFailed");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
        requestInFlightRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    refresh();
    const pollingInterval = window.setInterval(refresh, POLLING_INTERVAL_MS);
    const clockInterval = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      window.clearInterval(pollingInterval);
      window.clearInterval(clockInterval);
      abortControllerRef.current?.abort();
      requestInFlightRef.current = false;
    };
  }, [refresh]);

  const isStale =
    Boolean(monitoring?.sourceStale) ||
    Boolean(error && monitoring) ||
    Boolean(
      monitoring?.serverUpdatedAt &&
        now - new Date(monitoring.serverUpdatedAt).getTime() > STALE_AFTER_MS,
    ) ||
    Boolean(lastUpdatedAt && now - lastUpdatedAt > STALE_AFTER_MS);

  return {
    monitoring,
    loading,
    refreshing,
    error,
    lastUpdatedAt,
    isStale,
    refresh,
  };
}
