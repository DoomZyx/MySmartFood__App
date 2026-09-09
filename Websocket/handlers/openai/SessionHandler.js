/**
 * Gestionnaire de session OpenAI
 * Gère les événements liés à la session (session.updated)
 */
export class SessionHandler {
  constructor(streamSid, callLogger, openAiWs, state) {
    this.streamSid = streamSid;
    this.callLogger = callLogger;
    this.openAiWs = openAiWs;
    this.state = state; // Référence à l'état partagé
  }

  /**
   * Gère la mise à jour de session (déclenche la salutation initiale)
   * Envoie la phrase d'accueil : "Bonjour, [nom restaurant], je vous écoute"
   */
  async handleSessionUpdated(data) {
    if (!this.state.initialGreetingSent && this.openAiWs && this.openAiWs.readyState === 1) {
      this.state.initialGreetingSent = true;

      let greetingInstruction = "Dis exactement : Bonjour, je vous écoute.";
      try {
        const { getRestaurantInfo } = await import("../../../Services/gptServices/pricingService.js");
        const restaurantInfo = await getRestaurantInfo();
        const nomRestaurant = restaurantInfo?.nom || "le restaurant";
        greetingInstruction = `Dis exactement cette phrase d'accueil, rien d'autre : Bonjour, ${nomRestaurant}, je vous écoute.`;
      } catch (_) {
        // Fallback si erreur chargement config
      }

      this.callLogger.info(this.streamSid, "Envoi de la salutation automatique");

      this.openAiWs.send(JSON.stringify({
        type: "response.create",
        response: {
          instructions: greetingInstruction,
          output_modalities: ["audio"]
        }
      }));
    }
  }
}

