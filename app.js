// audit-fix: charger dotenv avant tout module qui utilise process.env (ex. auth.js via AuthService)
import "./Config/env.js";
import logger from "./Services/logging/logger.js";
import { sanitizeUrlForLog } from "./Services/logging/sanitizeLogUrl.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import path from "path";
import { fileURLToPath } from "url";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import callRoutes from "./Routes/Calls/call.js";
import wsRoutes from "./Routes/Ws/ws.js";
import processCallRoutes from "./Routes/CallData/processCall.js";
import authRoutes from "./Routes/Auth/auth.js";
import notificationRoutes from "./Routes/Ws/notifications.js";
import orderRoutes from "./Routes/Appointments/order.js";
import reservationRoutes from "./Routes/Appointments/reservation.js";
import pricingRoutes from "./Routes/Pricing/pricing.js";
import phoneLineRoutes from "./Routes/PhoneLine/phoneLine.js";
import callMinutesRoutes from "./Routes/CallMinutes/callMinutes.js";
import pingRoutes from "./Routes/Ping/ping.js";
import monitoringRoutes from "./Routes/Monitoring/monitoring.js";
import { multiTenantAuth } from "./API/middleware/multiTenantAuth.js";
import { AuthService } from "./Business/services/AuthService.js";
import mongoose from "mongoose";
import {
  beginHttpRequest,
  isProbePath,
  recordHttpRequest,
} from "./Services/monitoring/httpMetrics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function connectDB() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI manquant dans le fichier .env");
    }
    await mongoose.connect(process.env.MONGO_URI);
  } catch (err) {
    logger.error({ err: err.message }, "Erreur de connexion MongoDB");
    process.exit(1);
  }
}
await connectDB();

// audit-fix: exiger variables critiques au démarrage (pas de fallback en prod)
const requiredEnv = [{ name: "JWT_SECRET", minLen: 32 }];
for (const { name, minLen } of requiredEnv) {
  const v = process.env[name];
  if (!v || typeof v !== "string" || v.length < minLen) {
    logger.error(`Variable d'environnement ${name} manquante ou trop courte (min ${minLen} caractères).`);
    process.exit(1);
  }
}

// Créer l'utilisateur admin par défaut (désactivé en prod, voir AuthService)
await AuthService.createDefaultAdmin();


const fastify = Fastify();

fastify.addHook("onRequest", async (request) => {
  request._monitorStartedAt = Date.now();
  beginHttpRequest();
});

fastify.addHook("onResponse", async (request, reply) => {
  const startedAt = request._monitorStartedAt;
  const url = request.raw?.url || request.url || "";
  recordHttpRequest({
    statusCode: reply.statusCode,
    durationMs: startedAt != null ? Date.now() - startedAt : 0,
    path: url,
    isProbe: isProbePath(url),
  });
});

/**
 * CORS : avec credentials: true, il faut renvoyer l'origine exacte (pas *).
 * Si CORS_ORIGINS est défini sans le dashboard, le login cross-domain échoue silencieusement.
 * On fusionne par défaut les origines dashboard mysmartfood (désactivable avec CORS_STRICT_ORIGINS=true).
 */
function normalizeOrigin(origin) {
  if (!origin || typeof origin !== "string") {
    return "";
  }
  return origin.trim().replace(/\/+$/, "");
}

const corsOriginsFromEnv = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => normalizeOrigin(o)).filter(Boolean)
  : [];

const DASHBOARD_ORIGINS_DEFAULT = [
  "https://www.dashboard.mysmartfood.fr",
  "https://dashboard.mysmartfood.fr"
];
const FRONTEND_ORIGINS_DEFAULT = [
  "https://www.mysmartfood.fr",
  "https://mysmartfood.fr"
];
const ALWAYS_ALLOWED_ORIGINS = new Set(
  [...DASHBOARD_ORIGINS_DEFAULT, ...FRONTEND_ORIGINS_DEFAULT].map((origin) => normalizeOrigin(origin))
);

const corsStrict = process.env.CORS_STRICT_ORIGINS === "true";
const corsAllowList = corsStrict
  ? corsOriginsFromEnv
  : corsOriginsFromEnv.length > 0
    ? [...new Set([...corsOriginsFromEnv, ...DASHBOARD_ORIGINS_DEFAULT].map((origin) => normalizeOrigin(origin)))]
    : [];

/** Vide = désactivé ; non défini = .mysmartfood.fr */
const corsSuffix =
  process.env.CORS_ALLOW_SUBDOMAIN_SUFFIX === undefined
    ? ".mysmartfood.fr"
    : String(process.env.CORS_ALLOW_SUBDOMAIN_SUFFIX).trim();

function buildCorsOrigin() {
  if (corsOriginsFromEnv.length === 0) {
    return true;
  }
  return (origin, callback) => {
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) {
      callback(null, true);
      return;
    }
    if (ALWAYS_ALLOWED_ORIGINS.has(normalizedOrigin)) {
      callback(null, normalizedOrigin);
      return;
    }
    if (corsAllowList.includes(normalizedOrigin)) {
      callback(null, normalizedOrigin);
      return;
    }
    if (corsSuffix.length > 0) {
      try {
        const host = new URL(normalizedOrigin).hostname;
        const root = corsSuffix.replace(/^\./, "");
        if (root && (host === root || host.endsWith(`.${root}`))) {
          callback(null, normalizedOrigin);
          return;
        }
      } catch (_) {
        /* ignore */
      }
    }
    callback(null, false);
  };
}

await fastify.register(cors, {
  origin: buildCorsOrigin(),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-api-key",
    "Sec-WebSocket-Extensions",
    "Sec-WebSocket-Key",
    "Sec-WebSocket-Version"
  ],
});

fastify.register(fastifyFormBody);

// Documentation Swagger (interne) : /docs
await fastify.register(fastifySwagger, {
  mode: "static",
  specification: {
    path: path.join(__dirname, "docs", "openapi.json"),
  },
});
await fastify.register(fastifySwaggerUi, {
  routePrefix: "/docs",
  uiConfig: { docExpansion: "list", filter: true },
});

// Configuration multipart pour les uploads de fichiers
fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
});

// Servir les fichiers statiques (avatars, uploads)
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "uploads"),
  prefix: "/uploads/",
  decorateReply: false,
});


// Configuration WebSocket avec options pour maintenir les connexions actives
fastify.register(fastifyWs, {
  options: {
    perMessageDeflate: false, // Désactiver la compression pour les appels en temps réel
    clientTracking: true, // Garder trace des clients
    maxPayload: 100 * 1024 * 1024, // 100 MB pour les gros flux audio
    verifyClient: (info, callback) => {
      callback(true); // Accepter toutes les connexions
    }
  }
});

fastify.register(callRoutes);
fastify.register(wsRoutes);
fastify.register(notificationRoutes);

// Routes ping publiques (pour maintenir le backend actif)
fastify.register(pingRoutes, { prefix: "/api" });
fastify.register(monitoringRoutes, { prefix: "/api/monitoring" });

// Routes orders et réservations (système custom)
fastify.register(orderRoutes, { prefix: "/api" });
fastify.register(reservationRoutes, { prefix: "/api" });

// Routes pricing publiques (système custom)
fastify.register(pricingRoutes, { prefix: "/api" });

fastify.register(async (instance) => {
  // Pose request.instanceId depuis INSTANCE_ID (.env) — déploiement mono-client par dossier.
  instance.addHook("onRequest", multiTenantAuth);

  instance.register(processCallRoutes, { prefix: "/api" });
  instance.register(phoneLineRoutes, { prefix: "/api" });
  instance.register(callMinutesRoutes, { prefix: "/api" });
  instance.register(authRoutes, { prefix: "/api/auth" });
});

// Gestion globale des erreurs : Fastify log + Winston pour les 5xx (audit #14)
fastify.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) {
    logger.error(
      {
        err: error.message,
        stack: error.stack,
        statusCode,
        url: request?.url != null ? sanitizeUrlForLog(String(request.url)) : undefined,
        method: request?.method,
      },
      "Erreur 5xx"
    );
  }
  const isProd = process.env.NODE_ENV === "production";
  const message = isProd && statusCode === 500
    ? "Erreur interne du serveur"
    : (error.message || "Erreur interne du serveur");
  reply.code(statusCode).send({
    error: true,
    message,
  });
});

export default fastify;