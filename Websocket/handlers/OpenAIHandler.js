import { SessionHandler } from "./openai/SessionHandler.js";
import { ResponseHandler } from "./openai/ResponseHandler.js";
import { AudioHandler } from "./openai/AudioHandler.js";
import { TranscriptionHandler } from "./openai/TranscriptionHandler.js";
import { BargeInHandler } from "./openai/BargeInHandler.js";
import { FunctionCallHandler } from "./openai/FunctionCallHandler.js";
import { ErrorHandler } from "./openai/ErrorHandler.js";
import { updateStreamRoute } from "../../Services/streamRegistry.js";

/**
 * Gestionnaire principal des messages OpenAI
 * Orchestre tous les handlers spécialisés pour traiter les événements du WebSocket OpenAI
 * @param {string|null} streamSid
 * @param {import("ws").WebSocket} connection
 * @param {*} callLogger
 * @param {import("ws").WebSocket} openAiWs
 * @param {(() => void) | null} [onUserVoiceActivity] - Callback appelé à chaque activité vocale client (silence monitor)
 */
export class OpenAIHandler {
  constructor(streamSid, connection, callLogger, openAiWs, onUserVoiceActivity) {
    this.streamSid = streamSid;
    this.connection = connection;
    this.callLogger = callLogger;
    this.openAiWs = openAiWs;
    this.onUserVoiceActivity = typeof onUserVoiceActivity === "function" ? onUserVoiceActivity : null;

    // État partagé entre tous les handlers
    this.state = {
      transcription: `Appel démarré - StreamSid: ${streamSid}\n`,
      isAssistantSpeaking: false,
      currentResponseId: null,
      isInterrupted: false,
      currentResponseText: "",
      shouldCancel: false,
      isUserSpeaking: false,
      _audioDeltaLogged: false,
      _audioSuppressedLogged: false,
      initialGreetingSent: false,
      // Fallback humain : compteur d'échecs, dernière transcription client, garde contre double transfert
      consecutiveFailures: 0,
      lastUserTranscript: "",
      transferTriggered: false,
      callerNumber: null,
    };

    // Initialisation des handlers spécialisés
    this.sessionHandler = new SessionHandler(streamSid, callLogger, openAiWs, this.state);
    this.responseHandler = new ResponseHandler(streamSid, callLogger, openAiWs, connection, this.state);
    this.audioHandler = new AudioHandler(streamSid, connection, this.state);
    this.transcriptionHandler = new TranscriptionHandler(streamSid, callLogger, this.state);
    this.bargeInHandler = new BargeInHandler(streamSid, callLogger, openAiWs, connection, this.state);
    this.functionCallHandler = new FunctionCallHandler(streamSid, callLogger, openAiWs, this.state);
    this.errorHandler = new ErrorHandler(streamSid, callLogger);
  }

  /**
   * Point d'entrée pour tous les messages OpenAI
   * Délègue le traitement aux handlers spécialisés selon le type d'événement
   * @param {Object} data - Message reçu d'OpenAI
   */
  handleMessage(data) {
    switch (data.type) {
      case "session.updated":
        updateStreamRoute(this.streamSid, { stage: "listening" });
        this.sessionHandler.handleSessionUpdated(data);
        break;

      case "response.created":
        updateStreamRoute(this.streamSid, { stage: "speaking" });
        this.responseHandler.handleResponseCreated(data);
        break;

      case "response.cancelled":
        updateStreamRoute(this.streamSid, { stage: "listening" });
        this.responseHandler.handleResponseCancelled();
        break;

      case "response.output_audio.delta":
        this.audioHandler.handleAudioDelta(data);
        break;

      case "response.output_audio.done":
        this.responseHandler.handleAudioDone();
        break;

      case "response.done":
        updateStreamRoute(this.streamSid, { stage: "listening" });
        this.responseHandler.handleResponseCompleted(data);
        break;

      case "conversation.item.truncated":
        this.bargeInHandler.handleConversationTruncated(data);
        break;

      case "response.output_audio_transcript.delta":
        this.transcriptionHandler.handleAudioTranscriptDelta(data);
        break;

      case "response.output_text.delta":
        this.transcriptionHandler.handleTextDelta(data);
        break;

      case "input_audio_buffer.speech_started":
        updateStreamRoute(this.streamSid, { stage: "listening" });
        this.onUserVoiceActivity?.();
        this.bargeInHandler.handleUserSpeechStarted();
        break;

      case "input_audio_buffer.speech_stopped":
        this.bargeInHandler.handleUserSpeechStopped();
        break;

      case "input_audio_buffer.committed":
        this.bargeInHandler.handleUserSpeechCommitted();
        break;

      case "conversation.item.input_audio_transcription.completed":
        this.onUserVoiceActivity?.();
        this.transcriptionHandler.handleUserTranscription(data);
        break;

      case "response.function_call_arguments.delta":
        this.functionCallHandler.handleFunctionCallDelta(data);
        break;

      case "response.function_call_arguments.done":
        updateStreamRoute(this.streamSid, { stage: "processing" });
        this.functionCallHandler.handleFunctionCallCompleted(data);
        break;

      case "error":
        updateStreamRoute(this.streamSid, { stage: "error" });
        this.errorHandler.handleError(data);
        break;

      default:
        this.callLogger.debug(this.streamSid, `Message OpenAI: ${data.type}`, {
          messageType: data.type,
          hasTranscript: !!data.transcript,
        });
    }
  }

  /**
   * Met à jour le streamSid (appelé quand l'événement "start" arrive de Twilio)
   * @param {string} newStreamSid - Nouveau streamSid
   */
  setStreamSid(newStreamSid) {
    this.streamSid = newStreamSid;
    
    // Mettre à jour le streamSid dans tous les handlers
    this.sessionHandler.streamSid = newStreamSid;
    this.responseHandler.streamSid = newStreamSid;
    this.audioHandler.streamSid = newStreamSid;
    this.transcriptionHandler.streamSid = newStreamSid;
    this.bargeInHandler.streamSid = newStreamSid;
    this.functionCallHandler.streamSid = newStreamSid;
    this.errorHandler.streamSid = newStreamSid;
    
    // Mettre à jour la transcription dans l'état
    if (this.state.transcription.startsWith("Appel démarré - StreamSid: null")) {
      this.state.transcription = `Appel démarré - StreamSid: ${newStreamSid}\n`;
    }
  }

  /**
   * Définit le numéro fiable reçu directement de Twilio.
   * Il sera imposé aux appels de fonction de création.
   */
  setCallerNumber(callerNumber) {
    this.state.callerNumber = callerNumber || null;
  }

  /**
   * Récupère la transcription complète
   * @returns {string} Transcription de l'appel
   */
  getTranscription() {
    return this.state.transcription;
  }
}
