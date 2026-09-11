/**
 * Webhook vocal Twilio, unique par restaurant via le slug.
 */
export function voiceWebhookUrl(slug) {
  const host = String(
    process.env.VOICE_GATEWAY_PUBLIC_HOST || process.env.PUBLIC_HOST || ""
  ).replace(/\/$/, "");
  const safeSlug = String(slug || "").trim();
  if (!host || !safeSlug) return null;
  return `${host}/twilio/${safeSlug}/incoming-call`;
}
