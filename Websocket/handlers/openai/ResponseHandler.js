import {
  isRepeatRequestResponse,
  isAssistantTransferIntent,
  transferToHuman,
} from "../../../utils/humanTransfer.js";
import { getCallSid } from "../../../Services/streamRegistry.js";

/** Timestamp ISO pour logs barge-in (diagnostic temps réel) */
const ts = () => new Date().toISOString();

/**
 * Gestionnaire des réponses OpenAI
 * Gère les événements liés aux réponses (response.created, response.done, response.cancelled)
 */
export class ResponseHandler {
  constructor(streamSid, callLogger, openAiWs, twilioConnection, state) {
    this.streamSid = streamSid;
    this.callLogger = callLogger;
    this.openAiWs = openAiWs;
    this.twilioConnection = twilioConnection; // Connexion Twilio pour envoyer 'clear'
    this.state = state; // Référence à l'état partagé
  }

  /**
   * Début d'une nouvelle réponse de l'assistant.
   * Si shouldCancel est vrai ET que l'utilisateur est encore en train de parler,
   * on cancel tout de suite (barge-in).
   */
  handleResponseCreated(data) {
    this.state.currentResponseId = data.response?.id ?? null;
    this.state.isAssistantSpeaking = true;
    this.state._audioDeltaLogged = false;
    this.state.currentResponseText = "";

    // On annule seulement si l'utilisateur est ENCORE en train de parler
    if (this.state.shouldCancel && this.state.isUserSpeaking && this.state.currentResponseId && this.openAiWs?.readyState === 1) {

      // ÉTAPE 1 : Activer isInterrupted IMMÉDIATEMENT
      this.state.isInterrupted = true;

      // ÉTAPE 2 : Vider le buffer Twilio avec l'événement 'clear'
      if (this.twilioConnection && this.twilioConnection.readyState === 1) {
        try {
          this.twilioConnection.send(JSON.stringify({
            event: "clear",
            streamSid: this.streamSid
          }));
        } catch (error) {
          console.error(ts(), "❌ [TWILIO] Erreur envoi CLEAR:", error.message);
        }
      }

      // ÉTAPE 3 : Annuler la réponse OpenAI
      this.openAiWs.send(JSON.stringify({
        type: "response.cancel",
        response_id: this.state.currentResponseId
      }));

      this.state.currentResponseId = null;
      this.state.isAssistantSpeaking = false;
      this.state.shouldCancel = false;
      return;
    }

    // Si shouldCancel était true mais l'utilisateur a fini de parler, on réinitialise
    if (this.state.shouldCancel && !this.state.isUserSpeaking) {
      this.state.shouldCancel = false;
    }

    this.callLogger.debug(this.streamSid, "Réponse assistant démarrée", {
      responseId: this.state.currentResponseId
    });
  }

  /**
   * Fin de la réponse de l'assistant
   * IMPORTANT : On garde isAssistantSpeaking = true pendant 500ms après response.done
   * car l'audio est encore en buffer Twilio (200-500ms) et continue de jouer
   */
  async handleResponseCompleted(data) {
    const remainingText = this.state.currentResponseText.trim();

    // Fallback humain : si l'IA dit qu'elle transfère, exécuter le transfert réel (une seule fois)
    if (
      !this.state.transferTriggered &&
      isAssistantTransferIntent(remainingText)
    ) {
      const callSid = getCallSid(this.streamSid);
      if (callSid) {
        const ok = await transferToHuman(
          callSid,
          this.state.transcription,
          "ai_transfer_intent",
          this.state.instanceId
        );
        if (ok) this.state.transferTriggered = true;
      }
    }

    // Fallback humain : compter les échecs de compréhension (IA demande de répéter)
    if (isRepeatRequestResponse(remainingText)) {
      this.state.consecutiveFailures = (this.state.consecutiveFailures || 0) + 1;
      if (this.state.consecutiveFailures >= 2 && !this.state.transferTriggered) {
        const callSid = getCallSid(this.streamSid);
        if (callSid) {
          const ok = await transferToHuman(
            callSid,
            this.state.transcription,
            "ai_failure",
            this.state.instanceId
          );
          if (ok) this.state.transferTriggered = true;
        }
      }
    } else {
      this.state.consecutiveFailures = 0;
    }

    this.callLogger.extractionCompleted(this.streamSid, {
      output_text: remainingText ? remainingText.substring(0, 100) + "..." : "Déjà streamé",
    });


    // CRITIQUE : Garder isAssistantSpeaking = true pendant 800ms pour couvrir le buffer Twilio
    // L'audio continue de jouer dans Twilio même après response.done (buffer 200-500ms + marge)
    // On garde aussi _lastAudioDeltaTime pour le fallback barge-in
    setTimeout(() => {
      this.state.isAssistantSpeaking = false;
    }, 500); // 500ms pour couvrir le buffer Twilio (200-500ms) + marge de sécurité

    this.state.isInterrupted = false;
    this.state.currentResponseId = null;
    this.state.shouldCancel = false;
    this.state._audioDeltaLogged = false;
    this.state._audioSuppressedLogged = false;
    this.state.currentResponseText = "";
  }

  /**
   * Audio de la réponse terminé (response.audio.done)
   * IMPORTANT : On garde isAssistantSpeaking = true car l'audio est encore en buffer Twilio
   * L'audio continue de jouer dans Twilio même après response.audio.done
   */
  handleAudioDone() {
    console.log(ts(), "🔊 [OPENAI] response.audio.done", {
      responseId: this.state.currentResponseId,
      isAssistantSpeaking: this.state.isAssistantSpeaking,
      note: "Audio encore en buffer Twilio - isAssistantSpeaking reste true"
    });
    // CRITIQUE : On NE change PAS isAssistantSpeaking ici
    // L'audio est encore en train de jouer dans Twilio (buffer 200-500ms)
    // On attend response.done pour mettre isAssistantSpeaking = false
  }

  /**
   * Réponse annulée par le serveur (après notre response.cancel).
   * On ne remet pas isInterrupted = false ici (seul response.done le fait).
   */
  handleResponseCancelled() {
    this.state.isAssistantSpeaking = false;
    this.state.currentResponseId = null;
    this.state.shouldCancel = false;
    this.state._audioDeltaLogged = false;
    this.state._audioSuppressedLogged = false;
    this.callLogger.debug(this.streamSid, "Réponse assistant annulée (barge-in)");
  }
}

