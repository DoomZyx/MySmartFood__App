/**
 * Agrège l'état runtime du backend (process, HTTP, extraction, dépendances).
 * Les sondes publiques restent volontairement limitées ; le snapshot complet est admin.
 */

import circuitBreaker from "../gptServices/circuitBreaker.js";
import { getQueueStatus } from "../queue/transcriptionQueue.js";
import { getActiveCalls } from "../streamRegistry.js";
import notificationService from "../notificationService.js";
import { pingDatabase } from "../../database/pool.js";
import { FailedExtractionService } from "../gptServices/failedExtractionService.js";
import { getAllMetrics } from "./extractionMetrics.js";
import { getHttpMetrics } from "./httpMetrics.js";
import { getRecentAlerts, isAlertMonitoringActive } from "../alerting/alertService.js";
import { getExternalHealthSnapshot } from "./serviceHealth.js";
import { listCallFlow } from "./callFlowTrace.js";

const EVENT_LOOP_INTERVAL_MS = 500;
const HTTP_5XX_DEGRADED_RATE = 5;

let eventLoopTimer = null;
let eventLoopLagMs = 0;

function bytesToMb(bytes) {
  return Math.round((Number(bytes) || 0) / 1024 / 1024);
}

export function startRuntimeProbes() {
  if (eventLoopTimer) return;
  let expected = Date.now() + EVENT_LOOP_INTERVAL_MS;
  eventLoopTimer = setInterval(() => {
    const now = Date.now();
    eventLoopLagMs = Math.max(0, now - expected);
    expected = now + EVENT_LOOP_INTERVAL_MS;
  }, EVENT_LOOP_INTERVAL_MS);
  if (typeof eventLoopTimer.unref === "function") {
    eventLoopTimer.unref();
  }
}

export function stopRuntimeProbes() {
  if (!eventLoopTimer) return;
  clearInterval(eventLoopTimer);
  eventLoopTimer = null;
  eventLoopLagMs = 0;
}

export function getProcessSnapshot() {
  const memory = process.memoryUsage();
  return {
    pid: process.pid,
    uptimeSeconds: Math.floor(process.uptime()),
    node: process.version,
    environment: process.env.NODE_ENV || "development",
    memory: {
      heapUsedMb: bytesToMb(memory.heapUsed),
      heapTotalMb: bytesToMb(memory.heapTotal),
      rssMb: bytesToMb(memory.rss),
      externalMb: bytesToMb(memory.external),
    },
    eventLoopLagMs: Math.round(eventLoopLagMs),
  };
}

export async function getPostgresStatus() {
  return pingDatabase();
}

async function getFailedExtractions24h() {
  try {
    return await FailedExtractionService.countSince(new Date(Date.now() - 24 * 60 * 60 * 1000));
  } catch {
    return null;
  }
}

export function deriveOverallStatus({
  database,
  http,
  extraction,
  circuit,
  services = {},
}) {
  if (database.status !== "ok") return "unhealthy";
  const unavailableService = Object.values(services).some(
    (service) =>
      service?.configured !== false &&
      service?.status !== "healthy",
  );
  if (unavailableService) return "degraded";
  if (circuit.state === "OPEN") return "degraded";
  if ((http.errorRate || 0) >= HTTP_5XX_DEGRADED_RATE) return "degraded";
  if ((extraction.consecutiveFailures || 0) >= 10) return "degraded";
  return "healthy";
}

export async function getHealthPayload() {
  const database = await getPostgresStatus();
  const healthy = database.status === "ok";
  return {
    ok: healthy,
    body: {
      status: healthy ? "healthy" : "degraded",
      service: "RestaurantApp Backend",
      db: database.status,
      timestamp: new Date().toISOString(),
    },
  };
}

export async function getPublicStatusPayload() {
  const database = await getPostgresStatus();
  const processInfo = getProcessSnapshot();
  return {
    success: true,
    status: "running",
    db: database.status,
    environment: processInfo.environment,
    timestamp: new Date().toISOString(),
    uptime: processInfo.uptimeSeconds,
    memory: {
      used: processInfo.memory.heapUsedMb,
      total: processInfo.memory.heapTotalMb,
      rss: processInfo.memory.rssMb,
      unit: "MB",
    },
  };
}

function mergeActiveCalls(proxyCalls, voiceSessions) {
  const callsByStream = new Map(
    proxyCalls.map((call) => [call.streamSid, { ...call }]),
  );

  for (const voiceSession of voiceSessions) {
    const streamSid = voiceSession.streamSid;
    const existing = streamSid ? callsByStream.get(streamSid) : null;
    if (existing) {
      callsByStream.set(streamSid, {
        ...existing,
        stage: voiceSession.stage || existing.stage,
        provider: voiceSession.provider || null,
        lastError: voiceSession.lastError || null,
      });
      continue;
    }

    const key = streamSid || `voice-session-${callsByStream.size + 1}`;
    callsByStream.set(key, {
      streamSid,
      callSid: voiceSession.callSid,
      startedAt: null,
      elapsedSeconds: voiceSession.elapsedSeconds,
      route: "voice-server",
      instanceId: voiceSession.instanceId,
      stage: voiceSession.stage,
      provider: voiceSession.provider,
      lastError: voiceSession.lastError,
    });
  }

  return Array.from(callsByStream.values());
}

function unavailableVoiceEngine(voiceService) {
  return {
    ready: false,
    status:
      voiceService.configured === false ? "unknown" : "unhealthy",
    message:
      voiceService.configured === false
        ? "voice-server-disabled"
        : "voice-server-unavailable",
  };
}

function pickStageLatency(telemetry, stage) {
  const row = telemetry?.latency_ms?.[stage];
  if (!row) return null;
  return {
    last: row.last,
    average: row.average,
    min: row.min,
    max: row.max,
    count: row.count,
  };
}

function probeLatency(service) {
  if (!service?.configured || service.latencyMs == null) return null;
  return { last: service.latencyMs };
}

function isFallbackReady(fallbackApi, circuit) {
  return Boolean(
    fallbackApi?.configured &&
      fallbackApi.reachable &&
      circuit?.state !== "OPEN",
  );
}

function withVoiceFallback(voiceService, fallbackReady) {
  if (!voiceService || !fallbackReady) return voiceService;
  if (voiceService.status === "healthy") {
    return { ...voiceService, fallbackAvailable: true };
  }
  const next = {
    ...voiceService,
    status: "healthy",
    reachable: true,
    fallbackAvailable: true,
  };
  delete next.message;
  return next;
}

function buildFallbackApiLatency(externalHealth) {
  const llmOnFallback =
    externalHealth.voiceServer.llmProviderActive === "openai";
  const inference = llmOnFallback
    ? pickStageLatency(externalHealth.voiceServer.telemetry, "llm")
    : null;
  if (inference) return inference;
  const probe = externalHealth.fallbackApi;
  if (probe?.configured && probe.latencyMs != null) {
    return { last: probe.latencyMs };
  }
  return null;
}

function buildLatencies(database, externalHealth) {
  const telemetry = externalHealth.voiceServer.telemetry;
  return {
    gpuStt: pickStageLatency(telemetry, "stt"),
    gpuLlm: pickStageLatency(telemetry, "llm"),
    gpuTts: pickStageLatency(telemetry, "tts"),
    voiceToApi: pickStageLatency(telemetry, "node"),
    backendToVoice: probeLatency(externalHealth.voiceServer.service),
    fallbackApi: buildFallbackApiLatency(externalHealth),
    postgres:
      database.latencyMs != null ? { last: database.latencyMs } : null,
    gateway: probeLatency(externalHealth.gateway.service),
  };
}

export async function getFullSnapshot() {
  const [database, failedExtractions24h, externalHealth] = await Promise.all([
    getPostgresStatus(),
    getFailedExtractions24h(),
    getExternalHealthSnapshot(),
  ]);
  const processInfo = getProcessSnapshot();
  const http = getHttpMetrics();
  const extraction = getAllMetrics();
  const circuit = circuitBreaker.getState();
  const queue = getQueueStatus();
  const proxyCalls = getActiveCalls();
  const activeCalls = mergeActiveCalls(
    proxyCalls,
    externalHealth.voiceServer.activeSessions || [],
  );
  const services = {
    backend: {
      configured: true,
      status: "healthy",
      reachable: true,
    },
    postgres: {
      configured: true,
      status: database.status === "ok" ? "healthy" : "unhealthy",
      reachable: database.status === "ok",
      latencyMs: database.latencyMs ?? null,
      ...(database.error ? { message: database.error } : {}),
    },
    voiceServer: externalHealth.voiceServer.service,
    gateway: externalHealth.gateway.service,
  };
  const gpuVoiceDown = services.voiceServer?.status !== "healthy";
  const fallbackReady = isFallbackReady(externalHealth.fallbackApi, circuit);
  services.voiceServer = withVoiceFallback(services.voiceServer, fallbackReady);

  const status = deriveOverallStatus({
    database,
    http,
    extraction,
    circuit,
    services,
  });
  const voiceComponents = externalHealth.voiceServer.components || {};
  const voiceEngineFallback = unavailableVoiceEngine(services.voiceServer);
  const latencies = buildLatencies(database, externalHealth);

  return {
    status,
    timestamp: new Date().toISOString(),
    latencies,
    process: processInfo,
    dependencies: {
      postgresql: database,
    },
    services,
    engines: {
      vad: voiceComponents.vad || voiceEngineFallback,
      stt: voiceComponents.stt || voiceEngineFallback,
      llm: voiceComponents.llm || voiceEngineFallback,
      tts: voiceComponents.tts || voiceEngineFallback,
      voiceServer: externalHealth.voiceServer.engines || { ready: false },
      openaiRealtime: {
        status: circuit.state === "OPEN" ? "unhealthy" : "healthy",
        ready: circuit.state !== "OPEN",
        circuitBreakerState: circuit.state,
      },
    },
    fallbackOpenAI:
      externalHealth.voiceServer.llmProviderActive === "openai" ||
      (fallbackReady && gpuVoiceDown),
    http,
    extraction,
    openai: {
      circuitBreaker: {
        state: circuit.state,
        failures: circuit.failures,
        nextAttempt: circuit.nextAttempt,
      },
    },
    runtime: {
      activeMediaStreams: activeCalls.length,
      activeCalls,
      notificationSockets: notificationService.connections.size,
      transcriptionQueue: {
        queueSize: queue.queueSize,
        processing: queue.processing,
      },
    },
    persistence: {
      failedExtractions24h,
    },
    alerts: {
      active: isAlertMonitoringActive(),
      recent: getRecentAlerts(10),
    },
    callFlow: listCallFlow(),
  };
}

/** Vue restaurateur : état des services, sans internals process/HTTP. */
export function toRestaurantSnapshot(snapshot, tenantId) {
  const calls = (snapshot.runtime?.activeCalls || []).filter(
    (call) => tenantId && call.instanceId === tenantId
  );
  return {
    status: snapshot.status,
    timestamp: snapshot.timestamp,
    services: snapshot.services,
    engines: snapshot.engines,
    fallbackOpenAI: snapshot.fallbackOpenAI,
    latencies: snapshot.latencies || null,
    runtime: {
      activeMediaStreams: calls.length,
      activeCalls: calls.map((call) => ({
        streamSid: call.streamSid,
        startedAt: call.startedAt,
        elapsedSeconds: call.elapsedSeconds,
        route: call.route,
        stage: call.stage,
        provider: call.provider,
        lastError: call.lastError,
      })),
    },
    alerts: snapshot.alerts,
    callFlow: (snapshot.callFlow || []).filter(
      (event) => tenantId && event.tenantId === tenantId
    ),
  };
}

export function getMetricsPayload() {
  return {
    timestamp: new Date().toISOString(),
    http: getHttpMetrics(),
    extraction: getAllMetrics(),
    openai: {
      circuitBreaker: circuitBreaker.getState(),
    },
  };
}
