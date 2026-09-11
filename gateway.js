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
import crypto from "node:crypto";
import twilio from "twilio";
import "./Config/env.js";
import {
  generateTwiml,
  generateTwimlTransferToRestaurant,
} from "./Services/twilioServices/twilioServices.js";
import { connectDatabase, getPool } from "./database/pool.js";
import { withTenant } from "./database/transaction.js";
import { timingSafeEqualString } from "./utils/timingSafe.js";
import { routeVoiceConnection } from "./Routes/Ws/ws.js";
import { start as startAudioWorker } from "./workers/audioWorker.js";
import { start as startLlmWorker } from "./workers/llmWorker.js";
import logger from "./Services/logging/logger.js";
import { sanitizeUrlForLog } from "./Services/logging/sanitizeLogUrl.js";
import { getActiveStreamCount } from "./Services/streamRegistry.js";

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

  // Route webhook Twilio : entrée d'appel par slug (multi-tenant)
  fastify.post("/twilio/:slug/incoming-call", async (request, reply) => {
    if (!isValidTwilioWebhook(request)) {
      return reply.code(403).send({ error: "Signature Twilio invalide" });
    }
    const slug = request.params.slug;
    const result = await getPool().query(
      `SELECT id, slug
         FROM tenants
        WHERE slug = $1 AND status = 'active'
        LIMIT 1`,
      [slug],
    );
    const instance = result.rows[0];
    if (!instance) {
      return reply.code(404).send({ error: "Instance non trouvée ou inactive" });
    }
    const instanceId = instance.id;
    const settings = await withTenant(instanceId, async (db) => {
      const settingsResult = await db.query(
        `SELECT phone_line_enabled, transfer_phone
           FROM tenant_settings
          WHERE tenant_id = $1`,
        [instanceId],
      );
      return settingsResult.rows[0] || null;
    });
    if (!settings?.phone_line_enabled) {
      return reply
        .type("text/xml")
        .send(generateTwimlTransferToRestaurant(settings?.transfer_phone));
    }
    const host = process.env.VOICE_GATEWAY_PUBLIC_HOST || request.headers.host || "localhost:3001";
    const streamToken = createStreamToken(instanceId);
    const streamPath = `/v1/${instanceId}/media-stream?token=${encodeURIComponent(streamToken)}`;
    const callerNumber = request.body?.From ?? null;
    const xml = generateTwiml(host, streamPath, callerNumber, instanceId);
    return reply.type("text/xml").send(xml);
  });

  // WebSocket media-stream par instance (Twilio s'y connecte après le TwiML)
  fastify.get("/v1/:instanceId/media-stream", { websocket: true }, (connection, request) => {
    const instanceId = request.params.instanceId;
    if (!validateStreamToken(instanceId, request.query?.token)) {
      connection.close(1008, "Accès refusé");
      return;
    }
    routeVoiceConnection(connection, request, instanceId, {
      useWorkers: true,
    });
  });

  startAudioWorker();
  startLlmWorker();
  await fastify.listen({ port, host: "0.0.0.0" });
  logger.info({ port, pid: process.pid }, "Gateway vocal écoute");
}

function publicWebhookUrl(request) {
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const host =
    request.headers["x-forwarded-host"] ||
    process.env.VOICE_GATEWAY_PUBLIC_HOST ||
    request.headers.host;
  return `${protocol}://${host}${request.url}`;
}

function isValidTwilioWebhook(request) {
  const signature = request.headers["x-twilio-signature"];
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!signature || !authToken) return false;
  return twilio.validateRequest(
    authToken,
    signature,
    publicWebhookUrl(request),
    request.body || {},
  );
}

function createStreamToken(tenantId) {
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
  const payload = `${tenantId}.${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", process.env.TWILIO_AUTH_TOKEN)
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

function validateStreamToken(tenantId, token) {
  if (typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokenTenantId, expiresAt, providedSignature] = parts;
  if (tokenTenantId !== tenantId || Number(expiresAt) < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expectedSignature = crypto
    .createHmac("sha256", process.env.TWILIO_AUTH_TOKEN)
    .update(`${tokenTenantId}.${expiresAt}`)
    .digest("hex");
  return timingSafeEqualString(expectedSignature, providedSignature);
}
