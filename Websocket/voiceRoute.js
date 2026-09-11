/**
 * Routage Media Stream : Voice Service local en priorite, OpenAI Realtime en fallback.
 * Les logs FALLBACK GPT / VOICE LOCAL doivent rester explicites.
 */
import WebSocket from "ws";
import { callLogger } from "../Services/logging/logger.js";
import { getVoiceServiceTargets } from "../Config/voiceServiceTargets.js";

let nextVoiceTargetIndex = 0;

export function getVoiceTargets() {
  return getVoiceServiceTargets();
}

export function getVoiceHealthUrl() {
  return getVoiceTargets()[0].healthUrl;
}

export function getVoiceWsUrl() {
  return getVoiceTargets()[0].wsUrl;
}

/**
 * @param {boolean} reachable
 * @param {object|null} health
 * @returns {{ mode: "local"|"gpt", reason: string }}
 */
export function decideVoiceRoute(reachable, health) {
  if (!reachable) {
    return { mode: "gpt", reason: "Voice Service injoignable" };
  }
  if (!health?.engines?.ready) {
    return {
      mode: "gpt",
      reason: health?.engines?.error || "moteurs Voice Service non prets",
    };
  }
  return { mode: "local", reason: "engines.ready" };
}

export async function probeVoiceHealth(timeoutMs = 800) {
  const targets = getVoiceTargets();
  const results = await Promise.all(
    targets.map((target) => probeVoiceTarget(target, timeoutMs)),
  );
  const healthyTargets = results.filter((result) => result.mode === "local");
  if (healthyTargets.length === 0) {
    return {
      mode: "gpt",
      reason: results.map((result) => result.reason).join("; "),
    };
  }

  const selected = healthyTargets[nextVoiceTargetIndex % healthyTargets.length];
  nextVoiceTargetIndex += 1;
  return selected;
}

async function probeVoiceTarget(target, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(target.healthUrl, { signal: controller.signal });
    const health = await response.json().catch(() => null);
    return {
      ...decideVoiceRoute(response.ok, health),
      healthUrl: target.healthUrl,
      wsUrl: target.wsUrl,
    };
  } catch {
    return {
      ...decideVoiceRoute(false, null),
      healthUrl: target.healthUrl,
      wsUrl: target.wsUrl,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {import("ws")} twilioWs
 * @param {Buffer[]|string[]} queuedMessages
 * @param {string} targetUrl
 * @param {{ onOpen?: () => void }} [options]
 */
export function proxyTwilioToVoice(twilioWs, queuedMessages, targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const upstream = new WebSocket(targetUrl);
    let opened = false;

    const onTwilioMessage = (data) => {
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(data);
      }
    };

    const timer = setTimeout(() => {
      if (!opened) {
        upstream.terminate();
        reject(new Error("timeout connexion Voice Service"));
      }
    }, 2000);

    upstream.on("open", () => {
      opened = true;
      clearTimeout(timer);
      if (typeof options.onOpen === "function") {
        options.onOpen();
      }
      for (const msg of queuedMessages) {
        upstream.send(msg);
      }
      twilioWs.on("message", onTwilioMessage);
      callLogger.info(null, "VOICE LOCAL: Media Stream branche sur le Voice Service", {
        event: "voice_route_local",
        targetUrl,
      });
      resolve();
    });

    upstream.on("message", (data) => {
      if (twilioWs.readyState === WebSocket.OPEN) {
        twilioWs.send(data);
      }
    });

    twilioWs.on("close", () => {
      try {
        upstream.close();
      } catch {
        /* ignore */
      }
    });
    upstream.on("close", () => {
      try {
        if (twilioWs.readyState === WebSocket.OPEN) twilioWs.close();
      } catch {
        /* ignore */
      }
    });
    upstream.on("error", (error) => {
      if (!opened) {
        clearTimeout(timer);
        reject(error);
        return;
      }
      callLogger.error(null, error, {
        source: "voice_ws_proxy",
        context: "upstream_error",
      });
    });
  });
}
