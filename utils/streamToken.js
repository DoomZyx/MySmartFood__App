import crypto from "node:crypto";
import { timingSafeEqualString } from "./timingSafe.js";

function hmacSecret() {
  return process.env.TWILIO_AUTH_TOKEN || "";
}

function decodeToken(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function createStreamToken(tenantId) {
  const id = String(tenantId || "").trim();
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
  const payload = `${id}.${expiresAt}`;
  const signature = crypto.createHmac("sha256", hmacSecret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function streamTokenFailureReason(tenantId, token) {
  const provided = decodeToken(token);
  if (!provided) return "token absent";
  const parts = provided.split(".");
  if (parts.length !== 3) return `token mal forme (${parts.length} parties)`;
  const [tokenTenantId, expiresAt, providedSignature] = parts;
  if (tokenTenantId !== String(tenantId || "")) return "tenant mismatch";
  if (Number(expiresAt) < Math.floor(Date.now() / 1000)) return "token expire";
  if (!hmacSecret()) return "secret stream manquant";
  const expectedSignature = crypto
    .createHmac("sha256", hmacSecret())
    .update(`${tokenTenantId}.${expiresAt}`)
    .digest("hex");
  if (!timingSafeEqualString(expectedSignature, providedSignature)) {
    return "signature invalide";
  }
  return null;
}

export function validateStreamToken(tenantId, token) {
  return streamTokenFailureReason(tenantId, token) == null;
}

export function readStreamToken(request) {
  const fromParams = request?.params?.token;
  if (typeof fromParams === "string" && fromParams.trim()) return decodeToken(fromParams);
  const fromQuery = request?.query?.token;
  if (typeof fromQuery === "string" && fromQuery.trim()) return decodeToken(fromQuery);
  const raw = request?.raw?.url || request?.url || "";
  const queryIndex = raw.indexOf("?");
  if (queryIndex === -1) return "";
  try {
    return decodeToken(new URL(raw, "http://localhost").searchParams.get("token"));
  } catch {
    return "";
  }
}
