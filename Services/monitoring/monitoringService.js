/**
 * Agrège l'état runtime du backend (process, HTTP, extraction, dépendances).
 * Les sondes publiques restent volontairement limitées ; le snapshot complet est admin.
 */

import mongoose from "mongoose";
import circuitBreaker from "../gptServices/circuitBreaker.js";
import { getQueueStatus } from "../queue/transcriptionQueue.js";
import { getActiveCalls } from "../streamRegistry.js";
import notificationService from "../notificationService.js";
import FailedExtractionModel from "../../models/failedExtraction.js";
import { getAllMetrics } from "./extractionMetrics.js";
import { getHttpMetrics } from "./httpMetrics.js";
import { getRecentAlerts, isAlertMonitoringActive } from "../alerting/alertService.js";
import { getExternalHealthSnapshot } from "./serviceHealth.js";

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

export async function getMongoStatus() {
  const readyState = mongoose.connection.readyState;
  if (readyState !== 1 || !mongoose.connection.db) {
    return { status: "error", readyState };
  }
  try {
    await mongoose.connection.db.admin().command({ ping: 1 });
    return { status: "ok", readyState };
  } catch {
    return { status: "error", readyState };
  }
}

async function getFailedExtractions24h() {
  try {
    if (mongoose.connection.readyState !== 1) return null;
    return await FailedExtractionModel.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
  } catch {
    return null;
  }
}

export function deriveOverallStatus({
  mongo,
  http,
  extraction,
  circuit,
  services = {},
}) {
  if (mongo.status !== "ok") return "unhealthy";
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
  const mongo = await getMongoStatus();
  const healthy = mongo.status === "ok";
  return {
    ok: healthy,
    body: {
      status: healthy ? "healthy" : "degraded",
      service: "RestaurantApp Backend",
      db: mongo.status,
      timestamp: new Date().toISOString(),
    },
  };
}

export async function getPublicStatusPayload() {
  const mongo = await getMongoStatus();
  const processInfo = getProcessSnapshot();
  return {
    success: true,
    status: "running",
    db: mongo.status,
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

export async function getFullSnapshot() {
  const [mongo, failedExtractions24h, externalHealth] = await Promise.all([
    getMongoStatus(),
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
      status: mongo.status === "ok" ? "healthy" : "unhealthy",
      reachable: true,
    },
    voiceServer: externalHealth.voiceServer.service,
    gateway: externalHealth.gateway.service,
  };

  const status = deriveOverallStatus({
    mongo,
    http,
    extraction,
    circuit,
    services,
  });
  const voiceComponents = externalHealth.voiceServer.components || {};
  const voiceEngineFallback = unavailableVoiceEngine(services.voiceServer);

  return {
    status,
    timestamp: new Date().toISOString(),
    process: processInfo,
    dependencies: {
      mongodb: mongo,
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
      externalHealth.voiceServer.llmProviderActive === "openai",
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
