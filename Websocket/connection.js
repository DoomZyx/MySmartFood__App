import { createOpenAiSession } from "../Services/gptServices/gptServices.js";
import { getVoiceRuntimeConfig } from "../Config/voiceRuntimeConfig.js";
import WebSocket from "ws";
import dotenv from "dotenv";
import { callLogger } from "../Services/logging/logger.js";
import {
  registerStream,
  unregisterStream,
  getCallSid,
  updateStreamRoute,
} from "../Services/streamRegistry.js";
import { OpenAIHandler } from "./handlers/OpenAIHandler.js";
import { TwilioHandler } from "./handlers/TwilioHandler.js";
import { TranscriptionHandler } from "./handlers/TranscriptionHandler.js";
import { SilenceMonitor } from "./SilenceMonitor.js";
import { hangupDueToSilence } from "../utils/humanTransfer.js";
import { normalizeCallerPhone } from "../utils/callerPhone.js";
import { cleanAudio, checkRNNoiseAvailability } from "../Services/audioProcessing/audioCleaningService.js";
import { recordAudioChunk } from "../Services/audioProcessing/audioRecordingService.js";

dotenv.config();

/** Cache RNNoise (une vérification par processus, log une seule fois) */
let _rnnoiseAvailable = null;
async function getRnnoiseAvailable() {
  if (_rnnoiseAvailable === null) {
    _rnnoiseAvailable = await checkRNNoiseAvailability();
    if (_rnnoiseAvailable) {
      callLogger.info(null, "RNNoise activé - Réduction de bruit en temps réel");
    } else {
      callLogger.info(null, "RNNoise non disponible - Audio non filtré (service optionnel)");
    }
  }
  return _rnnoiseAvailable;
}

function buildCallerSessionUpdate(instanceConfig, callerNumber) {
  const basePayload = instanceConfig?.openAi?.sessionUpdatePayload;
  if (!basePayload?.session) return null;

  const phoneContext = callerNumber
    ? [
        `- Numéro de téléphone à utiliser pour create_appointment : ${callerNumber}`,
        "- Ne demande pas ce numéro au client.",
        "- Ne récite pas et ne confirme pas ce numéro oralement.",
      ]
    : [
        "- Le numéro est indisponible ou masqué.",
        "- Demande exceptionnellement son numéro une seule fois au client.",
      ];

  const callerInstructions = [
    basePayload.session.instructions,
    "",
    "CONTEXTE APPELANT FOURNI PAR LE SYSTÈME :",
    ...phoneContext,
  ].join("\n");

  return {
    ...basePayload,
    session: {
      ...basePayload.session,
      instructions: callerInstructions,
    },
  };
}

/**
 * Gestionnaire principal de la connexion WebSocket
 * Orchestre la communication entre Twilio et OpenAI
 *
 * @param {WebSocket} connection - Connexion WebSocket Twilio
 * @param {Object} request - Requête HTTP initiale
 * @param {string} [instanceId] - Instance (défaut: inst_default). Passé par le Gateway pour /v1/:instanceId/media-stream
 * @param {{ useWorkers?: boolean }} [options] - useWorkers: true pour passer par le bus (Gateway)
 */
export async function handleWebSocketConnection(connection, request, instanceId, options) {
  const resolvedInstanceId = instanceId != null && String(instanceId).trim() !== "" ? String(instanceId).trim() : "inst_default";
  const useWorkers = options?.useWorkers === true;
  try {
    callLogger.callStarted(null, { event: "client_connected", instanceId: resolvedInstanceId });

    // ==========================================
    // INITIALISATION DES VARIABLES
    // ==========================================
    let streamSid = null;
    let closeTimeout = null;
    const connectionId = useWorkers ? `conn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` : null;
    const callStartTime = Date.now();
    const CALL_WARNING_AT_MS = 4 * 60 * 1000;  // 4 min : avertissement client
    const CALL_MAX_DURATION_MS = 5 * 60 * 1000; // 5 min : raccrochage automatique
    let callWarningTimeout = null;
    let callHangupTimeout = null;
    let openAIHandler = null;
    let twilioHandler = null;
    let transcriptionHandler = null;
    let silenceMonitor = null;
    let audioChunkCount = 0;
    let audioChunkCountCleaned = 0;
    let unsubOpenaiOut = null;
    let llmWorkerRef = null;

    const rnnoiseAvailable = await getRnnoiseAvailable();
    const instanceConfig = await getVoiceRuntimeConfig(resolvedInstanceId);
    const useNoiseReduction = rnnoiseAvailable && instanceConfig.audio?.enableNoiseReduction !== false;

    silenceMonitor = new SilenceMonitor({
      getCallSid,
      onSilenceTimeout: async (sid) => {
        const callSid = getCallSid(sid);
        if (callSid) {
          callLogger.info(sid, "Silence prolongé détecté - raccrochage", { event: "SILENCE_TIMEOUT" });
          await hangupDueToSilence(callSid);
        }
      },
      silenceTimeoutMs: undefined,
    });

    // ==========================================
    // CRÉATION SESSION OPENAI (inline ou via workers)
    // ==========================================
    let openAiWs;
    if (useWorkers) {
      const { workerBus } = await import("../workers/workerBus.js");
      llmWorkerRef = await import("../workers/llmWorker.js");
      llmWorkerRef.createSession(instanceConfig, connectionId);
      openAiWs = {
        send(msg) {
          try {
            const data = typeof msg === "string" ? JSON.parse(msg) : msg;
            workerBus.publish("openai:in", { streamSid: connectionId, data });
          } catch (e) {
            console.error("[connection] openai:in parse error:", e);
          }
        },
        readyState: 1
      };
      unsubOpenaiOut = workerBus.subscribe("openai:out", (data) => {
        if (data.streamSid !== connectionId || !openAIHandler) return;
        openAIHandler.handleMessage(data.data);
      });
    } else {
      openAiWs = createOpenAiSession(instanceConfig);
    }

    // Handlers créés dès la connexion (streamSid = null) pour recevoir media avant "start"
    const onUserVoiceActivity = () => silenceMonitor?.onUserVoiceActivity();
    openAIHandler = new OpenAIHandler(null, connection, callLogger, openAiWs, /** @type {(() => void) | null} */ (onUserVoiceActivity));
    twilioHandler = new TwilioHandler(
      null,
      callLogger,
      async () => {
        if (transcriptionHandler && openAIHandler) {
          await transcriptionHandler.process(openAIHandler.getTranscription());
        }
      }
    );
    transcriptionHandler = new TranscriptionHandler(null, callLogger);

    // ==========================================
    // HANDLER MESSAGES TWILIO
    // ==========================================
    connection.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());

        // Événement START : mettre à jour streamSid dans les handlers
        if (data.event === "start") {
          streamSid = data.start.streamSid;
          const callerNumber = normalizeCallerPhone(
            data.start?.customParameters?.callerNumber,
          );
          openAIHandler.setStreamSid(streamSid);
          openAIHandler.setCallerNumber(callerNumber);
          twilioHandler.setStreamSid(streamSid);
          transcriptionHandler.setStreamSid(streamSid);
          transcriptionHandler.setCallerNumber(callerNumber);
          silenceMonitor.start(streamSid);
          twilioHandler.handleMessage(data);
          const callSid = data.start?.callSid || null;
          registerStream(streamSid, connection, callSid, {
            route: "openai-realtime",
            instanceId: resolvedInstanceId,
            stage: "active",
          });

          const callerSessionUpdate = buildCallerSessionUpdate(
            instanceConfig,
            callerNumber,
          );
          if (callerSessionUpdate) {
            const sendCallerSessionUpdate = () => {
              if (openAiWs?.readyState === WebSocket.OPEN) {
                openAiWs.send(JSON.stringify(callerSessionUpdate));
              }
            };

            if (openAiWs?.readyState === WebSocket.OPEN) {
              sendCallerSessionUpdate();
            } else if (!useWorkers && typeof openAiWs?.once === "function") {
              openAiWs.once("open", sendCallerSessionUpdate);
            }
          }
          if (useWorkers && typeof process !== "undefined" && process.pid) {
            console.log(`Worker ${process.pid} gère streamSid ${streamSid}`);
          }

          // Limite de durée d'appel : avertissement à 4 min, raccrochage à 5 min
          callWarningTimeout = setTimeout(() => {
            if (connection.readyState === WebSocket.OPEN && openAiWs?.readyState === WebSocket.OPEN) {
              callLogger.info(streamSid, "Limite 4 min atteinte - envoi avertissement au client");
              openAiWs.send(JSON.stringify({
                type: "response.create",
                response: {
                  instructions: "Dis exactement cette phrase, rien d'autre : L'appel sera terminé dans 1 minute.",
                  output_modalities: ["audio"]
                }
              }));
            }
            callWarningTimeout = null;
          }, CALL_WARNING_AT_MS);

          callHangupTimeout = setTimeout(() => {
            if (connection.readyState === WebSocket.OPEN) {
              callLogger.info(streamSid, "Limite duree atteinte (5 min) - raccrochage automatique");
              connection.close(1000, "Call duration limit");
            }
            callHangupTimeout = null;
          }, CALL_MAX_DURATION_MS);
        }

        // Événement MEDIA : via workers (bus) ou inline (monolith)
        if (data.event === "media" && openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          const currentStreamSid = streamSid || "unknown";
          audioChunkCount++;

          if (audioChunkCount === 1) {
            updateStreamRoute(currentStreamSid, { stage: "listening" });
            callLogger.info(currentStreamSid, "Premier chunk audio reçu - début enregistrement", {
              event: "audio_recording_started",
              rnnoiseAvailable
            });
          }

          if (useWorkers) {
            const { workerBus } = await import("../workers/workerBus.js");
            workerBus.publish("media:in", {
              streamSid: connectionId,
              payload: data.media.payload,
              useNoiseReduction
            });
          } else {
            if (audioChunkCount % 10 === 0 || audioChunkCount <= 5) {
              await recordAudioChunk(currentStreamSid, data.media.payload, false);
            }
            const audioPayload = useNoiseReduction
              ? await cleanAudio(data.media.payload)
              : data.media.payload;
            if (rnnoiseAvailable && audioPayload !== data.media.payload) {
              audioChunkCountCleaned++;
              if (audioChunkCountCleaned % 10 === 0 || audioChunkCountCleaned <= 5) {
                await recordAudioChunk(currentStreamSid, audioPayload, true);
              }
            }
            openAiWs.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: audioPayload,
              })
            );
          }
        } else if (twilioHandler) {
          // Autres événements Twilio
          twilioHandler.handleMessage(data);
        }
      } catch (err) {
        callLogger.error(streamSid, err, { source: "connection.js", context: "twilio_message_parse" });
      }
    });

    // ==========================================
    // HEARTBEAT (KEEPALIVE)
    // ==========================================
    const heartbeatInterval = setInterval(() => {
      if (connection.readyState === WebSocket.OPEN) {
        connection.ping();
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000); // Ping toutes les 30 secondes

    connection.on("pong", () => {
      // Heartbeat OK - connexion active
    });

    // ==========================================
    // HANDLER MESSAGES OPENAI (monolith uniquement ; en mode workers, openai:out est géré par l'abonnement bus)
    // ==========================================
    if (!useWorkers) {
      openAiWs.on("message", (msg) => {
        try {
          const data = JSON.parse(msg.toString());
          if (openAIHandler) {
            openAIHandler.handleMessage(data);
          }
        } catch (err) {
          callLogger.error(streamSid, err, { source: "connection.js", context: "openai_message_parse" });
        }
      });
    }

    // ==========================================
    // GESTION ERREURS & FERMETURE
    // ==========================================
    
    connection.on("error", (error) => {
      callLogger.error(streamSid, error, { source: "connection.js", context: "twilio_websocket_error" });
    });

    connection.on("close", (code, reason) => {
      if (silenceMonitor) {
        silenceMonitor.stop();
      }
      if (callWarningTimeout) {
        clearTimeout(callWarningTimeout);
        callWarningTimeout = null;
      }
      if (callHangupTimeout) {
        clearTimeout(callHangupTimeout);
        callHangupTimeout = null;
      }
      // Désenregistrer le stream
      if (streamSid) {
        updateStreamRoute(streamSid, { stage: "finalizing" });
        unregisterStream(streamSid);
      }
      // Nettoyer le heartbeat
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      
      const totalDuration = Date.now() - callStartTime;
      callLogger.callCompleted(streamSid, totalDuration, resolvedInstanceId);
      
      // Log récapitulatif audio
      if (audioChunkCount > 0) {
        callLogger.info(streamSid, "Récapitulatif enregistrement audio", {
          event: "audio_recording_summary",
          totalChunks: audioChunkCount,
          cleanedChunks: audioChunkCountCleaned,
          rnnoiseUsed: rnnoiseAvailable,
          duration: totalDuration
        });
      }

      // Fermer proprement la connexion OpenAI (monolith) ou détruire la session (workers)
      if (useWorkers && llmWorkerRef) {
        llmWorkerRef.destroySession(connectionId);
        if (unsubOpenaiOut) unsubOpenaiOut();
      } else if (!useWorkers && openAiWs.readyState === WebSocket.OPEN) {
        closeTimeout = setTimeout(() => {
          if (openAiWs.readyState === WebSocket.OPEN) {
            callLogger.info(streamSid, "Timeout écoulé, fermeture WS OpenAI");
            openAiWs.close();
          }
        }, 1000);
      }
    });

    if (!useWorkers) {
      openAiWs.on("error", (err) => {
        callLogger.error(streamSid, err, { source: "connection.js", context: "openai_websocket_error" });
      });
      openAiWs.on("close", () => {
        callLogger.info(streamSid, "Connexion OpenAI fermée");
      });
    }
    
  } catch (error) {
    callLogger.error(null, error, { source: "connection.js", context: "handleWebSocketConnection_init", instanceId: resolvedInstanceId });
    // Fermer proprement la connexion en cas d'erreur
    try {
      if (connection && connection.readyState === WebSocket.OPEN) {
        connection.close(1011, "Erreur interne du serveur");
      }
    } catch (closeError) {
      callLogger.error(null, closeError, { source: "connection.js", context: "close_on_fatal_error" });
    }
  }
}

