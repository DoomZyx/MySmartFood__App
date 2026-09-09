import { detectHumanRequest, shouldTransferToHuman, transferToHuman } from "../../../utils/humanTransfer.js";
import { getCallSid } from "../../../Services/streamRegistry.js";

/** Timestamp ISO pour logs barge-in (diagnostic temps réel) */
const ts = () => new Date().toISOString();

/**
 * Gestionnaire de barge-in (interruption)
 * Gère les événements d'interruption utilisateur (input_audio_buffer.speech_started, speech_stopped, committed)
 * CRITIQUE : Envoie l'événement 'clear' à Twilio pour vider le buffer audio lors des interruptions
 */
export class BargeInHandler {
  constructor(streamSid, callLogger, openAiWs, twilioConnection, state) {
    this.streamSid = streamSid;
    this.callLogger = callLogger;
    this.openAiWs = openAiWs;
    this.twilioConnection = twilioConnection; // Connexion Twilio pour envoyer 'clear'
    this.state = state; // Référence à l'état partagé
    this.speedManager = null; // Sera défini par OpenAIHandler
    
    // LOG DE DIAGNOSTIC : Vérifier que la connexion est bien passée
    console.log(ts(), "🔍 [DIAGNOSTIC] BargeInHandler initialisé", {
      streamSid: streamSid,
      hasTwilioConnection: !!twilioConnection,
      twilioConnectionType: twilioConnection?.constructor?.name,
      twilioReadyState: twilioConnection?.readyState,
      hasSendMethod: typeof twilioConnection?.send === "function"
    });
  }

  /**
   * Définit le gestionnaire de vitesse TTS
   * @param {TTSSpeedManager} speedManager - Gestionnaire de vitesse TTS
   */
  setSpeedManager(speedManager) {
    this.speedManager = speedManager;
  }

  /**
   * Barge-in : l'utilisateur commence à parler.
   * ORDRE CRITIQUE :
   * 1. isInterrupted = true (bloque les audio.delta futurs)
   * 2. Envoyer 'clear' à Twilio (vide le buffer audio)
   * 3. Envoyer 'response.cancel' à OpenAI (arrête la génération)
   */
  handleUserSpeechStarted() {
    this.state.isUserSpeaking = true;
    
    // LOGS DE DIAGNOSTIC COMPLETS
    console.log(ts(), "🎤 [VAD] speech_started", {
      isAssistantSpeaking: this.state.isAssistantSpeaking,
      currentResponseId: this.state.currentResponseId,
      streamSid: this.streamSid,
      hasTwilioConnection: !!this.twilioConnection,
      twilioReadyState: this.twilioConnection?.readyState,
      openAiReadyState: this.openAiWs?.readyState
    });

    if (!this.openAiWs || this.openAiWs.readyState !== 1) {
      console.log(ts(), "⚠️ [VAD] OpenAI WebSocket non disponible");
      return;
    }

    // DIAGNOSTIC : Vérifier si on entre dans la condition d'interruption
    // On considère une interruption si :
    // 1. isAssistantSpeaking = true (GPT parle actuellement)
    // 2. OU si on a reçu response.audio.delta récemment (audio en buffer Twilio)
    const isInterruption = this.state.isAssistantSpeaking && this.state.currentResponseId;
    
    console.log(ts(), "🔍 [DIAGNOSTIC] Vérification interruption", {
      isAssistantSpeaking: this.state.isAssistantSpeaking,
      hasResponseId: !!this.state.currentResponseId,
      currentResponseId: this.state.currentResponseId,
      isInterruption: isInterruption,
      note: "Si isAssistantSpeaking=false mais audio en buffer, on devrait quand même envoyer clear"
    });

    // Si l'assistant était en train de parler, c'est une INTERRUPTION
    // Même si isAssistantSpeaking est false, si l'audio est encore en buffer Twilio,
    // on doit envoyer clear pour vider le buffer
    if (isInterruption) {
      console.log(ts(), "⚠️ [BARGE-IN] INTERRUPTION DÉTECTÉE !", {
        responseId: this.state.currentResponseId,
        streamSid: this.streamSid
      });

      // ÉTAPE 1 : Activer isInterrupted IMMÉDIATEMENT
      // Cela bloque tous les audio.delta qui arrivent en parallèle
      this.state.isInterrupted = true;
      console.log(ts(), "🔒 [BARGE-IN] isInterrupted = true (audio bloqué)");

      // ÉTAPE 2 : Vider le buffer Twilio avec l'événement 'clear'
      // CRITIQUE : Cela arrête l'audio qui est déjà en buffer (200-500ms)
      console.log(ts(), "🔍 [DIAGNOSTIC] Vérification connexion Twilio avant CLEAR", {
        hasTwilioConnection: !!this.twilioConnection,
        twilioReadyState: this.twilioConnection?.readyState,
        streamSid: this.streamSid,
        connectionType: this.twilioConnection?.constructor?.name
      });

      if (this.twilioConnection) {
        const readyState = this.twilioConnection.readyState;
        console.log(ts(), "🔍 [DIAGNOSTIC] Connexion Twilio trouvée", {
          readyState: readyState,
          readyStateText: readyState === 1 ? "OPEN" : readyState === 0 ? "CONNECTING" : readyState === 2 ? "CLOSING" : "CLOSED",
          hasSendMethod: typeof this.twilioConnection.send === "function"
        });

        if (readyState === 1) {
          try {
            const clearMessage = {
              event: "clear",
              streamSid: this.streamSid
            };
            console.log(ts(), "📤 [TWILIO] Envoi CLEAR...", clearMessage);
            this.twilioConnection.send(JSON.stringify(clearMessage));
            console.log(ts(), "✅ [TWILIO] CLEAR envoyé avec succès - buffer audio vidé", {
              streamSid: this.streamSid
            });
          } catch (error) {
            console.error(ts(), "❌ [TWILIO] Erreur envoi CLEAR:", error.message, error.stack);
            this.callLogger.error(this.streamSid, error, {
              context: "twilio_clear_send_error"
            });
          }
        } else {
          console.log(ts(), "⚠️ [TWILIO] CLEAR non envoyé - connexion pas ouverte", {
            readyState: readyState,
            readyStateText: readyState === 0 ? "CONNECTING" : readyState === 2 ? "CLOSING" : "CLOSED"
          });
        }
      } else {
        console.error(ts(), "❌ [TWILIO] CLEAR non envoyé - connexion Twilio NULL/UNDEFINED", {
          twilioConnection: this.twilioConnection,
          streamSid: this.streamSid
        });
      }

      // ÉTAPE 3 : Annuler la réponse OpenAI en cours
      this.openAiWs.send(JSON.stringify({
        type: "response.cancel",
        response_id: this.state.currentResponseId
      }));
      console.log(ts(), "📤 [OPENAI] response.cancel envoyé", {
        responseId: this.state.currentResponseId
      });

      // Mettre à jour l'état
      this.state.currentResponseId = null;
      this.state.isAssistantSpeaking = false;
      
      this.callLogger.debug(this.streamSid, "Client commence a parler (barge-in)", {
        responseId: this.state.currentResponseId,
        clearSent: true
      });
      return;
    }

    // Si l'assistant ne parle pas encore, on marque pour annuler la réponse future
    this.state.shouldCancel = true;
    console.log(ts(), "📝 [OPENAI] Speech started before response.created, will cancel when response created if still speaking");
    
    // FALLBACK CRITIQUE : Même si isAssistantSpeaking est false, si on a reçu response.audio.delta récemment,
    // l'audio est peut-être encore en buffer Twilio. On envoie clear par précaution.
    // On vérifie si on a reçu de l'audio dans les 5000ms (pour couvrir la latence VAD importante + buffer Twilio)
    const timeSinceLastAudio = this.state._lastAudioDeltaTime ? Date.now() - this.state._lastAudioDeltaTime : Infinity;
    
    console.log(ts(), "🔍 [FALLBACK] Vérification audio récent", {
      hasLastAudioTime: !!this.state._lastAudioDeltaTime,
      timeSinceLastAudio: timeSinceLastAudio !== Infinity ? timeSinceLastAudio + "ms" : "jamais",
      threshold: "5000ms (latence VAD importante + buffer Twilio)",
      shouldSendClear: timeSinceLastAudio < 5000
    });
    
    // STRATÉGIE AGRESSIVE : Si on a envoyé de l'audio dans les 5 secondes, on envoie clear
    // Même si isAssistantSpeaking est false, l'audio peut encore jouer dans Twilio
    // La latence VAD peut être importante (plusieurs secondes) - l'utilisateur peut parler
    // pendant que l'audio joue, mais speech_started arrive avec un délai
    if (timeSinceLastAudio < 5000) {
      console.log(ts(), "⚠️ [FALLBACK] Audio récent détecté (buffer Twilio possible) - envoi CLEAR par précaution", {
        timeSinceLastAudio: timeSinceLastAudio + "ms",
        isAssistantSpeaking: this.state.isAssistantSpeaking,
        note: "Latence VAD peut faire que speech_started arrive après response.done"
      });
      
      // Activer isInterrupted pour bloquer les futurs audio.delta
      this.state.isInterrupted = true;
      console.log(ts(), "🔒 [FALLBACK] isInterrupted = true (audio bloqué)");
      
      if (this.twilioConnection && this.twilioConnection.readyState === 1) {
        try {
          const clearMessage = {
            event: "clear",
            streamSid: this.streamSid
          };
          console.log(ts(), "📤 [TWILIO] Envoi CLEAR (fallback)...", clearMessage);
          this.twilioConnection.send(JSON.stringify(clearMessage));
          console.log(ts(), "✅ [TWILIO] CLEAR envoyé avec succès (fallback - audio récent)");
        } catch (error) {
          console.error(ts(), "❌ [TWILIO] Erreur envoi CLEAR (fallback):", error.message, error.stack);
        }
      } else {
        console.log(ts(), "⚠️ [TWILIO] CLEAR non envoyé (fallback) - connexion fermée", {
          readyState: this.twilioConnection?.readyState
        });
      }
    } else {
      console.log(ts(), "ℹ️ [FALLBACK] Pas d'audio récent - pas de CLEAR nécessaire", {
        timeSinceLastAudio: timeSinceLastAudio !== Infinity ? timeSinceLastAudio + "ms" : "jamais",
        note: "Audio trop ancien, probablement déjà fini de jouer"
      });
    }
  }

  /**
   * L'utilisateur a fini de parler (speech_stopped).
   * On marque que l'utilisateur ne parle plus, mais on garde shouldCancel
   * car response.created pourrait arriver après.
   */
  handleUserSpeechStopped() {
    this.state.isUserSpeaking = false;
    console.log(ts(), "🔇 [VAD] speech_stopped", {
      shouldCancel: this.state.shouldCancel,
      isInterrupted: this.state.isInterrupted
    });
  }

  /**
   * L'audio de l'utilisateur a été commité (committed).
   * Avant toute réponse de l'IA : vérifier demande humain et seuil d'échecs -> transfert si besoin.
   * Sinon réinitialiser shouldCancel/isInterrupted et créer la réponse manuellement.
   */
  async handleUserSpeechCommitted() {
    this.state.isUserSpeaking = false;
    this.state.shouldCancel = false;

    const callSid = getCallSid(this.streamSid);

    // Fallback humain : avant toute réponse, vérifier demande explicite ou seuil d'échecs (une seule fois)
    if (callSid && !this.state.transferTriggered) {
      if (detectHumanRequest(this.state.lastUserTranscript)) {
        const ok = await transferToHuman(
          callSid,
          this.state.lastUserTranscript,
          "human_request"
        );
        if (ok) this.state.transferTriggered = true;
        return;
      }
      if (shouldTransferToHuman(this.state)) {
        const ok = await transferToHuman(
          callSid,
          this.state.lastUserTranscript || this.state.transcription,
          "ai_failure"
        );
        if (ok) this.state.transferTriggered = true;
        return;
      }
    }

    // CRITIQUE : Réinitialiser isInterrupted pour permettre à la nouvelle réponse de GPT de jouer
    if (this.state.isInterrupted) {
      this.state.isInterrupted = false;
      this.state._audioSuppressedLogged = false;
      console.log(ts(), "🔓 [VAD] isInterrupted = false (utilisateur a fini de parler, audio GPT autorisé)");
    }

    // GESTION MANUELLE : Créer la réponse manuellement après committed
    if (this.openAiWs && this.openAiWs.readyState === 1) {
      try {
        const now = Date.now();
        const lastCreate = this.state._lastManualResponseCreateAt || 0;
        if (now - lastCreate < 1000) {
          this.callLogger.debug(this.streamSid, "response.create ignore (debounce VAD)");
        } else {
          if (this.speedManager) {
            await this.speedManager.updateSpeedForContext();
          }
          this.state._lastManualResponseCreateAt = Date.now();
          this.openAiWs.send(JSON.stringify({
            type: "response.create"
          }));
          this.callLogger.debug(this.streamSid, "Réponse créée manuellement après committed");
        }
      } catch (error) {
        this.callLogger.error(this.streamSid, error, {
          context: "manual_response_create"
        });
      }
    }

    console.log(ts(), "✅ [VAD] speech_committed", {
      shouldCancel: "reset to false",
      isInterrupted: this.state.isInterrupted
    });
  }

  /**
   * Conversation tronquée (interruption détectée par OpenAI)
   * OpenAI a détecté l'interruption et a tronqué la réponse
   */
  handleConversationTruncated(data) {
    console.log(ts(), "🔪 [OPENAI] conversation.item.truncated - OpenAI a détecté l'interruption", {
      itemId: data.item?.id,
      truncated: data.item?.truncated
    });

    // S'assurer que isInterrupted est activé
    if (!this.state.isInterrupted) {
      this.state.isInterrupted = true;
      console.log(ts(), "🔒 [BARGE-IN] isInterrupted activé via truncated");
    }

    // Vider le buffer Twilio si ce n'est pas déjà fait
    if (this.twilioConnection && this.twilioConnection.readyState === 1) {
      try {
        this.twilioConnection.send(JSON.stringify({
          event: "clear",
          streamSid: this.streamSid
        }));
        console.log(ts(), "🧹 [TWILIO] CLEAR envoyé (via truncated) - buffer audio vidé");
      } catch (error) {
        console.error(ts(), "❌ [TWILIO] Erreur envoi CLEAR (truncated):", error.message);
      }
    }

    this.state.isAssistantSpeaking = false;
    this.callLogger.debug(this.streamSid, "Conversation tronquée (interruption OpenAI)");
  }
}

