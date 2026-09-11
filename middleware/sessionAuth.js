import jwt from "jsonwebtoken";
import * as User from "../models/pg/User.js";
import logger from "../Services/logging/logger.js";

export const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || "smartcrm_token";

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

export function clearSessionCookie(reply) {
  reply.clearCookie(JWT_COOKIE_NAME, { ...cookieOptions(), maxAge: 0 });
}

function looksLikeJwt(token) {
  return typeof token === "string" && token.split(".").length === 3;
}

function readCookieToken(request) {
  const raw = request.cookies?.[JWT_COOKIE_NAME];
  if (!raw) return null;
  if (typeof request.unsignCookie === "function") {
    const unsigned = request.unsignCookie(raw);
    if (unsigned?.valid && looksLikeJwt(unsigned.value)) return unsigned.value;
  }
  return looksLikeJwt(raw) ? raw : null;
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

export async function requirePlatformAdmin(request, reply) {
  await requireAuth(request, reply);
  if (reply.sent) return;
  if (!request.user.isPlatformAdmin) {
    return reply.code(403).send({ error: "Accès refusé" });
  }
}
