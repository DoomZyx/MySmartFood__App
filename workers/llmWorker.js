/**
 * Worker LLM : gère les sessions OpenAI par streamSid, reçoit audio via le bus, envoie à OpenAI, publie les sorties.
 * Phase 4 : module prêt à être branché (connection.js créera la session et s'abonnera à openai:out en Phase 5).
 */

import { workerBus } from "./workerBus.js";
import { createOpenAiSession } from "../Services/gptServices/gptServices.js";

const sessions = new Map();

let unsubscribeMediaCleaned = null;
let unsubscribeOpenaiIn = null;

/**
 * Crée une session OpenAI pour un stream et s'abonne aux réponses.
 * @param {Object} instanceConfig - Config de l'instance (openAi.sessionUpdatePayload, etc.)
 * @param {string} streamSid
 */
export function createSession(instanceConfig, streamSid) {
  if (sessions.has(streamSid)) {
    destroySession(streamSid);
  }
  const ws = createOpenAiSession(instanceConfig);
  ws.on("open", () => {
    const session = sessions.get(streamSid);
    if (!session) return;

    for (const payload of session.pendingControlMessages.splice(0)) {
      ws.send(payload);
    }
  });
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      workerBus.publish("openai:out", { streamSid, data });
    } catch (err) {
      console.error("[llmWorker] message parse error:", err);
    }
  });
  ws.on("close", () => {
    sessions.delete(streamSid);
  });
  ws.on("error", (err) => {
    console.error("[llmWorker] OpenAI WS error:", err);
    sessions.delete(streamSid);
  });
  sessions.set(streamSid, { ws, pendingControlMessages: [] });
}

/**
 * Envoie un chunk audio à la session OpenAI du stream.
 * @param {string} streamSid
 * @param {string} payload - Audio base64
 */
export function sendAudio(streamSid, payload) {
  const session = sessions.get(streamSid);
  if (!session?.ws || session.ws.readyState !== 1) return;
  session.ws.send(
    JSON.stringify({
      type: "input_audio_buffer.append",
      audio: payload
    })
  );
}

/**
 * Envoie un message JSON à la session OpenAI (response.create, input_audio_buffer.commit, etc.).
 * @param {string} streamSid
 * @param {Object} data - Objet à envoyer (sera JSON.stringify côté appelant ou ici)
 */
export function send(streamSid, data) {
  const session = sessions.get(streamSid);
  if (!session?.ws) return;
  const payload = typeof data === "string" ? data : JSON.stringify(data);

  if (session.ws.readyState === 0) {
    session.pendingControlMessages.push(payload);
    return;
  }
  if (session.ws.readyState !== 1) return;

  session.ws.send(payload);
}

/**
 * Ferme la session et retire du map.
 * @param {string} streamSid
 */
export function destroySession(streamSid) {
  const session = sessions.get(streamSid);
  if (session?.ws) {
    try {
      session.ws.close();
    } catch (_) {}
    sessions.delete(streamSid);
  }
}

/**
 * Démarre le worker : s'abonne à "media:cleaned" et "openai:in".
 */
export function start() {
  if (unsubscribeMediaCleaned) return;
  unsubscribeMediaCleaned = workerBus.subscribe("media:cleaned", (data) => {
    if (!data || typeof data.streamSid === "undefined") return;
    const { streamSid, payload } = data;
    sendAudio(streamSid, payload);
  });
  unsubscribeOpenaiIn = workerBus.subscribe("openai:in", (data) => {
    if (!data || typeof data.streamSid === "undefined") return;
    const { streamSid, data: msg } = data;
    send(streamSid, msg);
  });
}

/**
 * Arrête le worker (unsubscribe).
 */
export function stop() {
  if (unsubscribeMediaCleaned) {
    unsubscribeMediaCleaned();
    unsubscribeMediaCleaned = null;
  }
  if (unsubscribeOpenaiIn) {
    unsubscribeOpenaiIn();
    unsubscribeOpenaiIn = null;
  }
  for (const streamSid of sessions.keys()) {
    destroySession(streamSid);
  }
}
