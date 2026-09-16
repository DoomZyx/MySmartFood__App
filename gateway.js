/**
 * Gateway vocal léger (Phase 4) : routes Twilio + WebSocket media-stream uniquement.
 * S'exécute comme serveur séparé (port GATEWAY_PORT / 3001).
 * Mode cluster : un processus master lance N workers pour répartir les connexions WebSocket.
 * Chaque worker gère ses propres sessions (workerBus, llmWorker, audioWorker) de façon autonome.
 */

import cluster from "node:cluster";
import os from "node:os";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import "./Config/env.js";
import { connectDatabase } from "./database/pool.js";
import { start as startAudioWorker } from "./workers/audioWorker.js";
import { start as startLlmWorker } from "./workers/llmWorker.js";
import logger from "./Services/logging/logger.js";
import { sanitizeUrlForLog } from "./Services/logging/sanitizeLogUrl.js";
import { getActiveStreamCount } from "./Services/streamRegistry.js";
import voiceIngressRoutes from "./Routes/Twilio/voiceIngress.js";

const port = Number(process.env.GATEWAY_PORT) || 3001;
const numWorkers = process.env.GATEWAY_WORKERS
  ? parseInt(process.env.GATEWAY_WORKERS, 10)
  : os.cpus().length;

if (cluster.isPrimary) {
  logger.info({ numWorkers }, "Gateway master démarré");
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }
  cluster.on("exit", (worker) => {
    logger.info({ pid: worker.process.pid }, "Worker mort, redémarrage");
    cluster.fork();
  });
} else {
  startGatewayServer().catch((err) => {
    logger.error({ err: err?.message }, "Gateway worker");
    process.exit(1);
  });
}

/**
 * Démarre le serveur Fastify du Gateway dans le processus worker.
 * Chaque worker a sa propre boucle d'événements, ses propres sessions OpenAI et son workerBus.
 */
async function startGatewayServer() {
  await connectDatabase();
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      redact: {
        paths: ["req.headers.authorization", 'req.headers["x-api-key"]', "req.headers.cookie"],
        censor: "[Redacted]",
      },
      serializers: {
        req(req) {
          const url = typeof req.url === "string" ? sanitizeUrlForLog(req.url) : req.url;
          return {
            method: req.method,
            url,
            host: req.headers?.host,
            remoteAddress: req.socket?.remoteAddress,
            remotePort: req.socket?.remotePort,
          };
        },
      },
    },
  });

  // audit-fix: CORS restreint (Twilio/WebSocket); CORS_ORIGINS ou origine true si vide
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : [];
  await fastify.register(cors, {
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-key",
      "Sec-WebSocket-Extensions",
      "Sec-WebSocket-Key",
      "Sec-WebSocket-Version"
    ]
  });

  await fastify.register(fastifyFormBody);

  await fastify.register(fastifyWs, {
    options: {
      perMessageDeflate: false,
      maxPayload: 100 * 1024 * 1024
    }
  });

  fastify.get("/health", async (_request, reply) => {
    return reply.code(200).send({
      status: "healthy",
      service: "voice-gateway",
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      activeCalls: getActiveStreamCount(),
      timestamp: new Date().toISOString(),
    });
  });

  await fastify.register(voiceIngressRoutes, { useWorkers: true });

  startAudioWorker();
  startLlmWorker();
  await fastify.listen({ port, host: "0.0.0.0" });
  logger.info({ port, pid: process.pid }, "Gateway vocal écoute");
}
