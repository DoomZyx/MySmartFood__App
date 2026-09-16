import { detectHumanRequest, transferToHuman } from "../../../utils/humanTransfer.js";
import { getCallSid } from "../../../Services/streamRegistry.js";

/**
 * Gestionnaire de transcription OpenAI
 * Gère les événements de transcription (response.audio_transcript.delta, response.text.delta, conversation.item.input_audio_transcription.completed)
 */
export class TranscriptionHandler {
  constructor(streamSid, callLogger, state) {
    this.streamSid = streamSid;
    this.callLogger = callLogger;
    this.state = state; // Référence à l'état partagé
    this.speedManager = null; // Sera défini par OpenAIHandler
  }

  /**
   * Définit le gestionnaire de vitesse TTS
   * @param {TTSSpeedManager} speedManager - Gestionnaire de vitesse TTS
   */
  setSpeedManager(speedManager) {
    this.speedManager = speedManager;
  }

  /**
   * Réception d'un delta de transcription audio (assistant)
   */
  async handleAudioTranscriptDelta(data) {
    if (data.delta) {
      this.state.currentResponseText += data.delta;
      
      // Mettre à jour la transcription complète si nécessaire
      if (!this.state.isAssistantSpeaking) {
        this.state.transcription += "\nAssistant: ";
        this.state.isAssistantSpeaking = true;
      }
      this.state.transcription += data.delta;
      
      // Mettre à jour le gestionnaire de vitesse avec le dernier texte
      if (this.speedManager) {
        this.speedManager.updateLastAssistantText(this.state.currentResponseText);
      }
    }
  }

  /**
   * Réception de transcription utilisateur
   * Stocke la transcription pour le fallback humain et déclenche un transfert si demande explicite.
   * NOTE : Cette transcription n'est plus utilisée pour l'extraction.
   */
  async handleUserTranscription(data) {
    if (data.transcript) {
      this.state.lastUserTranscript = data.transcript;

      this.callLogger.info(
        this.streamSid,
        "Transcription client reçue d'OpenAI (non utilisée pour extraction)",
        {
          transcript: data.transcript.substring(0, 50) + "...",
          note: "Seule la transcription de GPT (répétition) sera utilisée pour l'extraction"
        }
      );

      // Fallback humain : demande explicite d'un humain -> transfert immédiat (une seule fois)
      if (
        !this.state.transferTriggered &&
        detectHumanRequest(data.transcript)
      ) {
        const callSid = getCallSid(this.streamSid);
        if (callSid) {
          const ok = await transferToHuman(
            callSid,
            data.transcript,
            "human_request",
            this.state.instanceId
          );
          if (ok) this.state.transferTriggered = true;
        }
      }
    }
  }

  /**
   * Réception de delta de texte (mode text, non audio)
   */
  handleTextDelta(data) {
    if (!this.state.isAssistantSpeaking) {
      this.state.transcription += "\nAssistant: ";
      this.state.isAssistantSpeaking = true;
    }
    this.state.transcription += data.delta;
    
    // Mettre à jour le gestionnaire de vitesse avec le dernier texte
    if (this.speedManager && data.delta) {
      this.speedManager.updateLastAssistantText(this.state.currentResponseText + data.delta);
    }
  }

  /**
   * Fin de texte
   */
  handleTextCompleted() {
    this.state.isAssistantSpeaking = false;
    this.state.transcription += "\n";
    
    // Mettre à jour le dernier texte de l'assistant dans le gestionnaire de vitesse
    if (this.speedManager) {
      this.speedManager.updateLastAssistantText(this.state.currentResponseText);
    }
  }
}

