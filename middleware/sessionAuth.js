import jwt from "jsonwebtoken";
import * as User from "../models/pg/User.js";
import logger from "../Services/logging/logger.js";

export const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || "smartcrm_token";
export const PLATFORM_ADMIN_COOKIE_NAME =
  process.env.PLATFORM_ADMIN_COOKIE_NAME || "smartcrm_platform";
export const PLATFORM_PENDING_COOKIE_NAME =
  process.env.PLATFORM_PENDING_COOKIE_NAME || "smartcrm_platform_pending";

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET doit être défini et comporter au moins 32 caractères");
  }
  return secret;
}

export function cookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  const domain = (process.env.COOKIE_DOMAIN || "").trim() || undefined;
  return {
    httpOnly: true,
    signed: false,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
    ...(domain ? { domain } : {}),
  };
}

export function signSessionToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    jwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

export function setSessionCookie(reply, user) {
  reply.setCookie(JWT_COOKIE_NAME, signSessionToken(user), cookieOptions());
}

export function platformCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    ...cookieOptions(),
    sameSite: isProduction ? "strict" : "lax",
    maxAge: 4 * 60 * 60,
  };
}

export function signPlatformToken(user) {
  return jwt.sign(
    { userId: user.id, scope: "platform-admin" },
    jwtSecret(),
    { expiresIn: process.env.PLATFORM_ADMIN_EXPIRES_IN || "4h" }
  );
}

export function setPlatformSessionCookie(reply, user) {
  reply.setCookie(
    PLATFORM_ADMIN_COOKIE_NAME,
    signPlatformToken(user),
    platformCookieOptions()
  );
}

export function clearPlatformSessionCookie(reply) {
  reply.clearCookie(PLATFORM_ADMIN_COOKIE_NAME, {
    ...platformCookieOptions(),
    maxAge: 0,
  });
}

export function pendingCookieOptions() {
  return {
    ...cookieOptions(),
    sameSite: "lax",
    maxAge: 10 * 60,
  };
}

export function setPlatformPendingCookie(reply, user, step) {
  const token = jwt.sign(
    { userId: user.id, scope: "platform-pending", step },
    jwtSecret(),
    { expiresIn: "10m" }
  );
  reply.setCookie(PLATFORM_PENDING_COOKIE_NAME, token, pendingCookieOptions());
}

export function clearPlatformPendingCookie(reply) {
  reply.clearCookie(PLATFORM_PENDING_COOKIE_NAME, {
    ...pendingCookieOptions(),
    maxAge: 0,
  });
}

export function clearSessionCookie(reply) {
  reply.clearCookie(JWT_COOKIE_NAME, { ...cookieOptions(), maxAge: 0 });
  clearPlatformSessionCookie(reply);
  clearPlatformPendingCookie(reply);
}

function readNamedCookieToken(request, name) {
  const raw = request.cookies?.[name];
  if (!raw) return null;
  if (typeof request.unsignCookie === "function") {
    const unsigned = request.unsignCookie(raw);
    if (unsigned?.valid && looksLikeJwt(unsigned.value)) return unsigned.value;
  }
  return looksLikeJwt(raw) ? raw : null;
}

function looksLikeJwt(token) {
  return typeof token === "string" && token.split(".").length === 3;
}

function readCookieToken(request) {
  return readNamedCookieToken(request, JWT_COOKIE_NAME);
}

function readToken(request) {
  const fromCookie = readCookieToken(request);
  if (fromCookie) return fromCookie;
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const bearer = header.slice(7).trim();
    if (bearer && bearer !== "null" && bearer !== "undefined" && looksLikeJwt(bearer)) {
      return bearer;
    }
  }
  return null;
}

export async function requireAuth(request, reply) {
  const token = readToken(request);
  if (!token) {
    return reply.code(401).send({ error: "Non authentifié" });
  }
  try {
    const decoded = jwt.verify(token, jwtSecret());
    const user = await User.findById(decoded.userId);
    if (!user) {
      return reply.code(401).send({ error: "Utilisateur invalide" });
    }
    request.user = user;
  } catch (err) {
    logger.error({ err: err?.message }, "Erreur d'authentification");
    return reply.code(401).send({ error: "Token invalide" });
  }
}

export async function requirePlatformPending(request, reply, expectedStep) {
  const token = readNamedCookieToken(request, PLATFORM_PENDING_COOKIE_NAME);
  if (!token) {
    return reply.code(401).send({ error: "Vérification back-office requise" });
  }
  try {
    const decoded = jwt.verify(token, jwtSecret());
    if (decoded.scope !== "platform-pending") {
      return reply.code(401).send({ error: "Vérification back-office requise" });
    }
    if (expectedStep && decoded.step !== expectedStep) {
      return reply.code(403).send({ error: "Étape 2FA invalide" });
    }
    const user = await User.findById(decoded.userId);
    if (!user?.isPlatformAdmin) {
      return reply.code(403).send({ error: "Accès refusé" });
    }
    request.user = user;
    request.platformPendingStep = decoded.step;
  } catch {
    return reply.code(401).send({ error: "Vérification back-office requise" });
  }
}

export async function requirePlatformAdmin(request, reply) {
  await requireAuth(request, reply);
  if (reply.sent) return;
  if (!request.user.isPlatformAdmin) {
    return reply.code(403).send({ error: "Accès refusé" });
  }
  const platformToken = readNamedCookieToken(request, PLATFORM_ADMIN_COOKIE_NAME);
  if (!platformToken) {
    return reply.code(403).send({ error: "Vérification back-office requise" });
  }
  try {
    const decoded = jwt.verify(platformToken, jwtSecret());
    if (decoded.scope !== "platform-admin" || decoded.userId !== request.user.id) {
      return reply.code(403).send({ error: "Vérification back-office requise" });
    }
    request.platformVerified = true;
  } catch {
    return reply.code(403).send({ error: "Vérification back-office requise" });
  }
}

export async function requirePlatformOwner(request, reply) {
  await requirePlatformAdmin(request, reply);
  if (reply.sent) return;
  if (!request.user.isPlatformOwner) {
    return reply.code(403).send({ error: "Gestion des comptes réservée au propriétaire" });
  }
}
