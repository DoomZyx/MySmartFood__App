/**
 * Gestionnaire de session OpenAI
 * Gère les événements liés à la session (session.updated)
 */
export function buildGreetingInstruction(restaurantName) {
  const greeting = restaurantName
    ? `${restaurantName}, bonjour. Que puis-je faire pour vous ?`
    : "Bonjour, que puis-je faire pour vous ?";

  return `Dis exactement cette phrase, avec un ton naturel et accueillant : ${greeting}`;
}

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

      let greetingInstruction = buildGreetingInstruction();
      try {
        const { getRestaurantInfo } = await import("../../../Services/gptServices/pricingService.js");
        const restaurantInfo = await getRestaurantInfo();
        greetingInstruction = buildGreetingInstruction(restaurantInfo?.nom);
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

