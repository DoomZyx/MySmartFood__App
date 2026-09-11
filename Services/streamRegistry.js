const activeStreams = new Map();

function normalizeOptionalText(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

/**
 * Enregistre un flux sans stocker de numéro de téléphone.
 *
 * @param {string} streamSid
 * @param {object} connection
 * @param {string|null} callSid
 * @param {{ route?: string, instanceId?: string, stage?: string }} [metadata]
 */
export function registerStream(streamSid, connection, callSid, metadata = {}) {
  if (!streamSid || !connection) return;
  const existing = activeStreams.get(streamSid);
  activeStreams.set(streamSid, {
    connection,
    callSid: normalizeOptionalText(callSid) ?? existing?.callSid ?? null,
    startedAt: existing?.startedAt ?? Date.now(),
    route:
      normalizeOptionalText(metadata.route) ?? existing?.route ?? "unknown",
    instanceId:
      normalizeOptionalText(metadata.instanceId) ??
      existing?.instanceId ??
      null,
    stage:
      normalizeOptionalText(metadata.stage) ?? existing?.stage ?? null,
  });
}

export function unregisterStream(streamSid) {
  if (!streamSid) return;
  activeStreams.delete(streamSid);
}

/**
 * Récupère le callSid associé à un stream (pour transfert humain Twilio).
 * @param {string} streamSid - SID du stream Twilio
 * @returns {string|null} callSid ou null
 */
export function getCallSid(streamSid) {
  if (!streamSid) return null;
  const entry = activeStreams.get(streamSid);
  return entry ? entry.callSid : null;
}

export function getActiveStreamCount() {
  return activeStreams.size;
}

/**
 * Met à jour uniquement les informations de routage affichables.
 *
 * @param {string} streamSid
 * @param {{ route?: string, stage?: string }} updates
 * @returns {boolean}
 */
export function updateStreamRoute(streamSid, updates = {}) {
  const entry = activeStreams.get(streamSid);
  if (!entry) return false;

  if (Object.prototype.hasOwnProperty.call(updates, "route")) {
    entry.route = normalizeOptionalText(updates.route) ?? "unknown";
  }
  if (Object.prototype.hasOwnProperty.call(updates, "stage")) {
    entry.stage = normalizeOptionalText(updates.stage);
  }
  return true;
}

/**
 * Retourne une vue strictement sanitizée des appels actifs.
 */
export function getActiveCalls() {
  const now = Date.now();
  return Array.from(activeStreams.entries()).map(([streamSid, entry]) => ({
    streamSid,
    callSid: entry.callSid,
    startedAt: new Date(entry.startedAt).toISOString(),
    elapsedSeconds: Math.max(0, Math.floor((now - entry.startedAt) / 1000)),
    route: entry.route,
    instanceId: entry.instanceId,
    ...(entry.stage ? { stage: entry.stage } : {}),
  }));
}

export function stopStream(streamSid, reason = "Stopped by API") {
  const entry = activeStreams.get(streamSid);
  if (!entry) return false;
  try {
    if (entry.connection && entry.connection.readyState === entry.connection.OPEN) {
      entry.connection.close(4000, reason);
    }
  } finally {
    activeStreams.delete(streamSid);
  }
  return true;
}

export default {
  registerStream,
  unregisterStream,
  stopStream,
  getCallSid,
  getActiveStreamCount,
  getActiveCalls,
  updateStreamRoute,
};


