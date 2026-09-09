import { detectConversationContext, getSpeedForContext, TTS_SPEED_CONFIG } from '../../Config/ttsSpeedConfig.js';

/**
 * Gestionnaire de vitesse TTS dynamique pour l'API Realtime
 * 
 * Gère la mise à jour du paramètre speed entre les tours de conversation
 * pour optimiser la fluidité tout en garantissant la compréhensibilité des informations critiques
 */
export class TTSSpeedManager {
  constructor(streamSid, callLogger, openAiWs) {
    this.streamSid = streamSid;
    this.callLogger = callLogger;
    this.openAiWs = openAiWs;
    this.currentSpeed = TTS_SPEED_CONFIG.DEFAULT;
    this.transcription = '';
    this.lastAssistantText = '';
  }

  /**
   * Met à jour la transcription pour l'analyse de contexte
   * @param {string} newTranscription - Nouvelle transcription complète
   */
  updateTranscription(newTranscription) {
    this.transcription = newTranscription;
  }

  /**
   * Met à jour le dernier texte prononcé par l'assistant
   * @param {string} text - Texte prononcé par l'assistant
   */
  updateLastAssistantText(text) {
    this.lastAssistantText = text;
  }

  /**
   * Détermine et applique la vitesse TTS appropriée selon le contexte
   * Doit être appelé AVANT response.create (après input_audio_buffer.committed)
   * 
   * @returns {Promise<boolean>} true si la vitesse a été mise à jour, false sinon
   */
  async updateSpeedForContext() {
    if (!this.openAiWs || this.openAiWs.readyState !== 1) {
      this.callLogger.debug(this.streamSid, 'WebSocket OpenAI non disponible pour mise à jour speed');
      return false;
    }

    // Détecter le contexte de conversation
    const context = detectConversationContext(this.transcription, this.lastAssistantText);
    const targetSpeed = getSpeedForContext(context);

    // Ne mettre à jour que si la vitesse a changé
    if (targetSpeed === this.currentSpeed) {
      this.callLogger.debug(this.streamSid, `Vitesse TTS inchangée: ${this.currentSpeed} (contexte: ${context})`);
      return false;
    }

    // Mettre à jour la vitesse via session.update
    try {
      const sessionUpdate = {
        type: 'session.update',
        session: {
          type: 'realtime',
          audio: {
            output: {
              speed: targetSpeed
            }
          }
        }
      };

      this.openAiWs.send(JSON.stringify(sessionUpdate));
      this.currentSpeed = targetSpeed;

      this.callLogger.info(this.streamSid, `Vitesse TTS mise à jour: ${this.currentSpeed} → ${targetSpeed} (contexte: ${context})`, {
        previousSpeed: this.currentSpeed,
        newSpeed: targetSpeed,
        context: context
      });

      return true;
    } catch (error) {
      this.callLogger.error(this.streamSid, error, {
        context: 'tts_speed_update_error',
        targetSpeed: targetSpeed,
        detectedContext: context
      });
      return false;
    }
  }

  /**
   * Réinitialise la vitesse à la valeur par défaut
   */
  resetSpeed() {
    this.currentSpeed = TTS_SPEED_CONFIG.DEFAULT;
  }

  /**
   * Obtient la vitesse actuelle
   * @returns {number} Vitesse TTS actuelle
   */
  getCurrentSpeed() {
    return this.currentSpeed;
  }
}

