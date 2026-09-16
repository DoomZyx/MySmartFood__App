import logger from "../logging/logger.js";

const MAX_EVENTS = 40;
const events = [];

function clip(value, max = 180) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

function maskPhone(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (text.length <= 4) return "***";
  return `***${text.slice(-4)}`;
}

/**
 * Journal court du flux d'un appel (webhook → TwiML → stream).
 * Pas de numéro appelant complet.
 */
export function recordCallFlow(event = {}) {
  const entry = {
    id: `${Date.now()}-${events.length}`,
    at: new Date().toISOString(),
    callSid: clip(event.callSid, 64),
    to: clip(event.to, 20),
    fromMasked: maskPhone(event.from),
    slug: clip(event.slug, 80),
    tenantId: clip(event.tenantId, 64),
    stage: clip(event.stage, 40) || "webhook",
    outcome: clip(event.outcome, 20) || "ok",
    detail: clip(event.detail, 180),
  };
  events.unshift(entry);
  if (events.length > MAX_EVENTS) events.pop();
  logger.info(
    {
      callSid: entry.callSid,
      slug: entry.slug,
      tenantId: entry.tenantId,
      stage: entry.stage,
      outcome: entry.outcome,
      detail: entry.detail,
      to: entry.to,
    },
    "CALL_FLOW"
  );
  return entry;
}

export function listCallFlow(tenantId) {
  const id = tenantId ? String(tenantId) : "";
  const rows = id ? events.filter((item) => item.tenantId === id) : events;
  return rows.slice(0, MAX_EVENTS);
}

export function resetCallFlow() {
  events.length = 0;
}
