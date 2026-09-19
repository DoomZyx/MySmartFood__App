import { handleWebSocketConnection } from "../../Websocket/connection.js";
import {
  getVoiceWsUrl,
  probeVoiceHealth,
  proxyTwilioToVoice,
} from "../../Websocket/voiceRoute.js";
import { callLogger } from "../../Services/logging/logger.js";
import {
  registerStream,
  unregisterStream,
  updateStreamRoute,
} from "../../Services/streamRegistry.js";
import { config } from "../../Config/env.js";
import { resolveRuntimeTenantId } from "../../utils/runtimeTenant.js";
import { streamTokenFailureReason } from "../../utils/streamToken.js";
import { recordCallFlow } from "../../Services/monitoring/callFlowTrace.js";

function getInstanceIdFromEnv() {
  return resolveRuntimeTenantId();
}

function replayQueued(connection, queued) {
  for (const msg of queued) {
    connection.emit("message", msg);
  }
}

function streamTokenFromStart(data) {
  const params = data?.start?.customParameters || {};
  return params.streamToken || params.token || params.StreamToken || "";
}

function waitForTwilioStart(connection, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("start timeout"));
    }, timeoutMs);
    const onMessage = (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.event !== "start") return;
        cleanup();
        resolve(data);
      } catch {
        /* media binaire ignore */
      }
    };
    const onClose = () => {
      cleanup();
      reject(new Error("websocket ferme avant start"));
    };
    const cleanup = () => {
      clearTimeout(timer);
      connection.off("message", onMessage);
      connection.off("close", onClose);
    };
    connection.on("message", onMessage);
    connection.once("close", onClose);
  });
}

export default async function wsRoutes(fastify) {
  fastify.get("/media-stream", { websocket: true }, async (connection, request) => {
    await routeVoiceConnection(
      connection,
      request,
      getInstanceIdFromEnv(),
      { requireStreamToken: true },
    );
  });
}

export async function routeVoiceConnection(
  connection,
  request,
  instanceId,
  connectionOptions,
) {
  const queued = [];
  const collect = (data) => queued.push(data);
  let streamSid = null;
  let selectedRoute = "pending";
  let selectedStage = "routing";

  const updateRoute = (route, stage) => {
    selectedRoute = route;
    selectedStage = stage;
    if (streamSid) {
      updateStreamRoute(streamSid, { route, stage });
    }
  };

  const trackStart = (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.event !== "start" || !data.start?.streamSid) return;
      streamSid = data.start.streamSid;
      registerStream(streamSid, connection, data.start.callSid || null, {
        route: selectedRoute,
        instanceId,
        stage: selectedStage,
      });
    } catch {
      // Le gestionnaire vocal journalise les messages invalides.
    }
  };

  connection.on("message", collect);
  connection.on("message", trackStart);
  connection.once("close", () => {
    connection.off("message", trackStart);
    if (streamSid) unregisterStream(streamSid);
  });

  if (connectionOptions?.requireStreamToken) {
    try {
      const startData = await waitForTwilioStart(connection);
      const failure = streamTokenFailureReason(
        instanceId,
        streamTokenFromStart(startData),
      );
      if (failure) {
        recordCallFlow({
          tenantId: instanceId,
          stage: "stream",
          outcome: "hangup",
          detail: `token media-stream: ${failure}`,
        });
        connection.close(1008, "Accès refusé");
        return;
      }
      recordCallFlow({
        tenantId: instanceId,
        callSid: startData.start?.callSid || null,
        stage: "stream",
        outcome: "ok",
        detail: "start Twilio authentifie",
      });
    } catch (error) {
      recordCallFlow({
        tenantId: instanceId,
        stage: "stream",
        outcome: "hangup",
        detail: `token media-stream: ${error?.message || "start manquant"}`,
      });
      try {
        connection.close(1008, "Accès refusé");
      } catch {
        /* deja ferme */
      }
      return;
    }
  }

  const startGpt = async (reason) => {
    updateRoute("openai-realtime", "connecting");
    callLogger.warn(null, "FALLBACK GPT: bascule OpenAI Realtime", {
      event: "voice_route_fallback_gpt",
      reason,
      path: "openai-realtime",
    });
    connection.off("message", collect);
    connection.on("message", collect);
    await handleWebSocketConnection(
      connection,
      request,
      instanceId,
      connectionOptions,
    );
    connection.off("message", collect);
    replayQueued(connection, queued);
  };

  try {
    if (config.VOICE_PROVIDER === "openai_realtime") {
      await startGpt(`environnement ${config.APP_ENV} configuré pour OpenAI Realtime`);
      return;
    }

    if (config.VOICE_PROVIDER !== "python") {
      await startGpt(`VOICE_PROVIDER inconnu: ${config.VOICE_PROVIDER}`);
      return;
    }

    const route = await probeVoiceHealth();
    if (route.mode === "local") {
      try {
        updateRoute("voice-server", "connecting");
        await proxyTwilioToVoice(
          connection,
          queued,
          route.wsUrl || getVoiceWsUrl(),
          {
            onOpen: () => {
              updateRoute("voice-server", "active");
              connection.off("message", collect);
            },
          },
        );
        return;
      } catch (error) {
        await startGpt(error?.message || "proxy Voice Service impossible");
        return;
      }
    }
    await startGpt(route.reason);
  } catch (error) {
    await startGpt(error?.message || "erreur de routage");
  }
}
