import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import csrfProtection from "@fastify/csrf-protection";

export async function registerSecurityPlugins(fastify) {
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  await fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET || process.env.JWT_SECRET,
  });

  await fastify.register(rateLimit, {
    global: true,
    max: Number(process.env.RATE_LIMIT_MAX) || 200,
    timeWindow: "1 minute",
  });

  await fastify.register(csrfProtection, {
    cookieKey: "_csrf",
    cookieOpts: {
      signed: true,
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  });
}

export function buildCorsOrigin() {
  const normalize = (origin) => (origin || "").trim().replace(/\/+$/, "");
  const fromEnv = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(normalize).filter(Boolean)
    : [];
  const isProduction = process.env.NODE_ENV === "production";

  const defaults = [
    "https://www.dashboard.mysmartfood.fr",
    "https://dashboard.mysmartfood.fr",
    "https://www.mysmartfood.fr",
    "https://mysmartfood.fr",
  ];

  if (!isProduction) {
    defaults.push("http://localhost:5173", "http://localhost:5174");
  }

  const allowList = [...new Set([...fromEnv, ...defaults].map(normalize))];

  if (fromEnv.length === 0 && !isProduction) {
    return true;
  }

  return (origin, callback) => {
    const normalized = normalize(origin);
    if (!normalized) {
      callback(null, true);
      return;
    }
    if (allowList.includes(normalized)) {
      callback(null, normalized);
      return;
    }
    callback(null, false);
  };
}
