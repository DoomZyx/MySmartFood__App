/**
 * Webhook vocal Twilio par établissement : /twilio/:slug/incoming-call.
 * Le numéro appelé doit appartenir à ce slug (isolation).
 */

function trimHost(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

/** Hostname public sans schéma (pour wss:// et la signature Twilio). */
export function voicePublicHostname(value) {
  const raw = trimHost(value);
  if (!raw) return "";
  try {
    if (raw.includes("://")) return new URL(raw).host;
  } catch {
    /* host déjà nu */
  }
  return raw.replace(/^\/\//, "");
}

let cachedHost = "";
let cachedUntil = 0;

export function resetVoicePublicHostCache() {
  cachedHost = "";
  cachedUntil = 0;
}

function shouldProbeNgrok() {
  if (process.env.JEST_WORKER_ID) return false;
  if (trimHost(process.env.VOICE_GATEWAY_PUBLIC_HOST || "")) return false;
  return String(process.env.APP_ENV || "").trim() === "dev";
}

function pickNgrokHttpsUrl(tunnels) {
  const httpsTunnels = (tunnels || []).filter((tunnel) =>
    String(tunnel?.public_url || "").startsWith("https://")
  );
  if (httpsTunnels.length === 0) return "";
  const port = String(process.env.PORT || "8080");
  const matching = httpsTunnels.find((tunnel) =>
    String(tunnel.config?.addr || "").includes(`:${port}`)
  );
  return trimHost((matching || httpsTunnels[0]).public_url);
}

async function detectNgrokPublicUrl() {
  const inspector = trimHost(process.env.NGROK_INSPECTOR_URL || "http://127.0.0.1:4040");
  try {
    const response = await fetch(`${inspector}/api/tunnels`, {
      signal: AbortSignal.timeout(800),
    });
    if (!response.ok) return "";
    const payload = await response.json();
    return pickNgrokHttpsUrl(payload?.tunnels);
  } catch {
    return "";
  }
}

/** Hôte public réel : tunnel ngrok live en dev, sinon PUBLIC_HOST. */
export async function resolveVoicePublicHost() {
  const dedicated = trimHost(process.env.VOICE_GATEWAY_PUBLIC_HOST || "");
  if (dedicated) return dedicated;
  if (!shouldProbeNgrok()) {
    return trimHost(process.env.PUBLIC_HOST || "");
  }
  const now = Date.now();
  if (cachedHost && now < cachedUntil) return cachedHost;
  const live = await detectNgrokPublicUrl();
  const host = live || trimHost(process.env.PUBLIC_HOST || "");
  cachedHost = host;
  cachedUntil = now + 15_000;
  return host;
}

export function sanitizeTenantSlug(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(text)) return null;
  return text;
}

export function voiceWebhookUrl(slug, host = process.env.VOICE_GATEWAY_PUBLIC_HOST || process.env.PUBLIC_HOST || "") {
  const resolved = trimHost(host);
  if (!resolved) return null;
  const safeSlug = sanitizeTenantSlug(slug);
  if (safeSlug) return `${resolved}/twilio/${safeSlug}/incoming-call`;
  return `${resolved}/twilio/incoming-call`;
}

export function voiceStreamHost(request) {
  return (
    voicePublicHostname(request?.headers?.["x-forwarded-host"]) ||
    voicePublicHostname(request?.headers?.host) ||
    voicePublicHostname(process.env.VOICE_GATEWAY_PUBLIC_HOST) ||
    voicePublicHostname(process.env.PUBLIC_HOST) ||
    "localhost:8080"
  );
}

/** Champs Twilio pour que voiceUrl soit vraiment utilisé (pas une TwiML App / trunk). */
export async function incomingNumberVoiceUpdate(slug) {
  const host = await resolveVoicePublicHost();
  const voiceUrl = voiceWebhookUrl(slug, host);
  if (!voiceUrl) return null;
  return {
    voiceUrl,
    voiceMethod: "POST",
    voiceApplicationSid: "",
    trunkSid: "",
  };
}
