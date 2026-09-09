const activeStreams = new Map(); // streamSid -> { connection, callSid, startedAt }

export function registerStream(streamSid, connection, callSid) {
  if (!streamSid || !connection) return;
  activeStreams.set(streamSid, {
    connection,
    callSid: callSid || null,
    startedAt: Date.now(),
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
};


