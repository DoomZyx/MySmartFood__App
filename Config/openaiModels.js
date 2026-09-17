import { decrypt } from "../utils/encryption.js";

/** Fallback appel : OpenAI Realtime (Fastify si le voice-server GPU est down). */
export const OPENAI_REALTIME_MODEL = "gpt-realtime-1.5";

/** Fallback tour : OpenAI Chat Completions (voice-server si vLLM échoue). */
export const OPENAI_CHAT_MODEL = "gpt-4o-mini";

export function sanitizeOpenAiModel(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (!/^[a-zA-Z0-9._:-]{3,80}$/.test(text)) {
    const err = new Error("Modèle OpenAI invalide");
    err.statusCode = 400;
    throw err;
  }
  return text;
}

export function sanitizeOpenAiKey(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (text.length < 20 || text.length > 256) {
    const err = new Error("Clé API OpenAI invalide");
    err.statusCode = 400;
    throw err;
  }
  return text;
}

export function resolveOpenAiCredentials({ tenant, settings, env = process.env } = {}) {
  const tenantKey = decrypt(tenant?.openaiApiKey || "").trim();
  return {
    apiKey: tenantKey || String(env.OPENAI_API_KEY || "").trim(),
    model:
      String(tenant?.openaiModel || "").trim() ||
      String(settings?.voiceModel || "").trim() ||
      String(env.OPENAI_MODEL || "").trim() ||
      OPENAI_REALTIME_MODEL,
  };
}
