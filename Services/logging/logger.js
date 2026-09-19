/**
 * Logs sur stdout/stderr uniquement (plus de fichiers Winston).
 * API inchangée : default export + callLogger + notifDebugLog.
 * Les champs sensibles restent masqués dans les objets loggés.
 */
import { sanitizeUrlForLog } from "./sanitizeLogUrl.js";

const LEVEL_RANK = { error: 0, warn: 1, info: 2, debug: 3 };
const envLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");
const minRank = LEVEL_RANK[envLevel] ?? LEVEL_RANK.info;

function isSensitiveMetaKey(k) {
  const n = String(k).toLowerCase();
  return (
    n === "apikey" ||
    n === "api_key" ||
    n === "x-api-key" ||
    n === "authorization" ||
    n === "password" ||
    n === "temporarypassword" ||
    n === "token" ||
    n === "secret" ||
    n === "twilioauthtoken" ||
    n === "authtoken" ||
    n === "cookie"
  );
}

function redactSensitiveDeep(value, depth = 0) {
  if (depth > 10 || value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (/api_key=/i.test(value)) return sanitizeUrlForLog(value);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactSensitiveDeep(v, depth + 1));
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (isSensitiveMetaKey(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactSensitiveDeep(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

/** Gère (msg, meta) et (meta, msg) comme avec Winston dans ce projet. */
function pickMessageAndMeta(a, b) {
  if (typeof a === "string") {
    return { message: a, meta: b != null && typeof b === "object" ? b : {} };
  }
  if (typeof b === "string" && a != null && typeof a === "object") {
    return { message: b, meta: a };
  }
  if (a != null && typeof a === "object") {
    return { message: b != null && typeof b === "string" ? b : (a.message ?? "[object]"), meta: a };
  }
  return { message: String(a), meta: {} };
}

function emit(level, a, b) {
  if (LEVEL_RANK[level] > minRank) return;
  const { message, meta: rawMeta } = pickMessageAndMeta(a, b);
  const meta = redactSensitiveDeep(rawMeta);
  const ts = new Date().toISOString();
  const prefix = `${ts} [${level.toUpperCase()}] ${message}`;
  const hasMeta = meta && typeof meta === "object" && Object.keys(meta).length > 0;
  if (level === "error") {
    if (hasMeta) console.error(prefix, meta);
    else console.error(prefix);
  } else if (level === "warn") {
    if (hasMeta) console.warn(prefix, meta);
    else console.warn(prefix);
  } else if (level === "debug") {
    if (hasMeta) console.debug(prefix, meta);
    else console.debug(prefix);
  } else {
    if (hasMeta) console.log(prefix, meta);
    else console.log(prefix);
  }
}

const logger = {
  error: (a, b) => emit("error", a, b),
  warn: (a, b) => emit("warn", a, b),
  info: (a, b) => emit("info", a, b),
  debug: (a, b) => emit("debug", a, b),
};

export const callLogger = {
  info: (streamSid, message, meta = {}) => {
    logger.info(message, { streamSid, ...meta, timestamp: new Date().toISOString() });
  },
  debug: (streamSid, message, meta = {}) => {
    logger.debug(message, { streamSid, ...meta, timestamp: new Date().toISOString() });
  },
  warn: (streamSid, message, meta = {}) => {
    logger.warn(message, { streamSid, ...meta, timestamp: new Date().toISOString() });
  },
  openAi: {
    info: (streamSid, message, meta = {}) => {
      logger.info(message, { streamSid, service: "openai", ...meta, timestamp: new Date().toISOString() });
    },
    debug: (streamSid, message, meta = {}) => {
      logger.debug(message, { streamSid, service: "openai", ...meta, timestamp: new Date().toISOString() });
    },
    error: (streamSid, error, context = {}) => {
      logger.error("Erreur OpenAI", {
        streamSid,
        service: "openai",
        error: error?.message,
        stack: error?.stack,
        context,
        event: "openai_error",
        timestamp: new Date().toISOString(),
      });
    },
  },
  callStarted: (streamSid, callerInfo = {}) => {
    logger.info("Appel demarre", {
      streamSid,
      callerInfo,
      event: "call_started",
      timestamp: new Date().toISOString(),
    });
  },
  transcriptionReceived: (streamSid, transcriptionLength) => {
    logger.info("Transcription recue", {
      streamSid,
      transcriptionLength,
      event: "transcription_received",
      timestamp: new Date().toISOString(),
    });
  },
  extractionStarted: (streamSid) => {
    logger.info("Extraction GPT-4 demarree", {
      streamSid,
      event: "extraction_started",
      timestamp: new Date().toISOString(),
    });
  },
  extractionCompleted: (streamSid, extractedData) => {
    logger.info("Extraction GPT-4 terminee", {
      streamSid,
      extractedData,
      event: "extraction_completed",
      timestamp: new Date().toISOString(),
    });
  },
  apiCallStarted: (streamSid, endpoint) => {
    logger.info("Appel API demarre", {
      streamSid,
      endpoint,
      event: "api_call_started",
      timestamp: new Date().toISOString(),
    });
  },
  apiCallCompleted: (streamSid, response) => {
    logger.info("Appel API termine", {
      streamSid,
      responseStatus: response.status,
      event: "api_call_completed",
      timestamp: new Date().toISOString(),
    });
  },
  error: (streamSid, error, context = {}) => {
    const message = error?.message || (typeof error === "string" ? error : "Erreur inconnue");
    const { source, ...rest } = typeof context === "object" ? context : { context };
    logger.error(message, {
      streamSid,
      source: source || "app",
      error: error?.message,
      stack: error?.stack,
      ...rest,
      event: "error",
      timestamp: new Date().toISOString(),
    });
  },
  performance: (streamSid, operation, duration) => {
    logger.info("Performance", {
      streamSid,
      operation,
      duration: `${duration}ms`,
      event: "performance",
      timestamp: new Date().toISOString(),
    });
  },
  callCompleted: (streamSid, totalDuration, meta = {}) => {
    const payload = {
      streamSid,
      totalDuration: `${totalDuration}ms`,
      event: "call_completed",
      timestamp: new Date().toISOString(),
    };
    if (typeof meta === "string") payload.instanceId = meta;
    else if (meta && typeof meta === "object") Object.assign(payload, meta);
    logger.info("Appel termine avec succes", payload);
  },
};

export function notifDebugLog(msg) {
  console.log(`[NOTIF] ${msg}`);
}

export default logger;
