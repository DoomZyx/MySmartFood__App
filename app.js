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
import wsRoutes from "./Routes/Ws/ws.js";
import notificationRoutes from "./Routes/Ws/notifications.js";
import pingRoutes from "./Routes/Ping/ping.js";
import monitoringRoutes from "./Routes/Monitoring/monitoring.js";
import { connectDatabase } from "./database/pool.js";
import { registerSecurityPlugins, buildCorsOrigin } from "./plugins/security.js";
import { registerGoogleOAuth } from "./plugins/googleOAuth.js";
import accountAuthRoutes from "./Routes/Auth/accountAuth.js";
import checkoutRoutes, { stripeWebhookRoutes } from "./Routes/Billing/checkout.js";
import contactRoutes from "./Routes/Site/contact.js";
import demoRoutes from "./Routes/Site/demo.js";
import onboardingRoutes from "./Routes/Onboarding/onboarding.js";
import tenantDataRoutes from "./Routes/TenantData/tenantData.js";
import twilioBundleWebhookRoutes from "./Routes/Twilio/bundleWebhook.js";
import csrfRoutes from "./Routes/Csrf/csrf.js";
import pricingRoutes from "./Routes/Pricing/pricing.js";
import orderRoutes from "./Routes/Appointments/order.js";
import reservationRoutes from "./Routes/Appointments/reservation.js";
import phoneLineRoutes from "./Routes/PhoneLine/phoneLine.js";
import callClientRoutes from "./Routes/Calls/callClient.js";
import callRoutes from "./Routes/Calls/call.js";
import processCallRoutes from "./Routes/CallData/processCall.js";
import voiceContextRoutes from "./Routes/Voice/voiceContext.js";
import {
  beginHttpRequest,
  isProbePath,
  recordHttpRequest,
} from "./Services/monitoring/httpMetrics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquant : PostgreSQL est obligatoire");
}
await connectDatabase();

// audit-fix: exiger variables critiques au démarrage (pas de fallback en prod)
const requiredEnv = [{ name: "JWT_SECRET", minLen: 32 }];
for (const { name, minLen } of requiredEnv) {
  const v = process.env[name];
  if (!v || typeof v !== "string" || v.length < minLen) {
    logger.error(`Variable d'environnement ${name} manquante ou trop courte (min ${minLen} caractères).`);
    process.exit(1);
  }
}

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

function legacyBuildCorsOrigin() {
  if (corsOriginsFromEnv.length === 0 && process.env.NODE_ENV !== "production") {
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
    if (corsSuffix.length > 0 && process.env.NODE_ENV !== "production") {
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
    "x-csrf-token",
    "x-tenant-id",
    "Sec-WebSocket-Extensions",
    "Sec-WebSocket-Key",
    "Sec-WebSocket-Version"
  ],
});

await registerSecurityPlugins(fastify);
await fastify.register(stripeWebhookRoutes);
await fastify.register(twilioBundleWebhookRoutes);
await registerGoogleOAuth(fastify);
await fastify.register(csrfRoutes);

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

fastify.register(wsRoutes);
fastify.register(notificationRoutes);

// Routes ping publiques (pour maintenir le backend actif)
fastify.register(pingRoutes, { prefix: "/api" });
fastify.register(monitoringRoutes, { prefix: "/api/monitoring" });

fastify.register(accountAuthRoutes, { prefix: "/api/auth" });
fastify.register(checkoutRoutes, { prefix: "/api/checkout" });
fastify.register(contactRoutes, { prefix: "/api/contact" });
fastify.register(demoRoutes, { prefix: "/api/demo" });
fastify.register(onboardingRoutes, { prefix: "/api/onboarding" });
fastify.register(tenantDataRoutes, { prefix: "/api/tenant" });
fastify.register(pricingRoutes, { prefix: "/api" });
fastify.register(orderRoutes, { prefix: "/api" });
fastify.register(reservationRoutes, { prefix: "/api" });
fastify.register(phoneLineRoutes, { prefix: "/api" });
fastify.register(callClientRoutes, { prefix: "/api" });
fastify.register(callRoutes, { prefix: "/api" });
fastify.register(processCallRoutes, { prefix: "/api" });
fastify.register(voiceContextRoutes, { prefix: "/api/voice" });

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