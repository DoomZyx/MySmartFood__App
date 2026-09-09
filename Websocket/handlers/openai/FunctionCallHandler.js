import { FunctionCallService } from "../../services/FunctionCallService.js";

/**
 * Gestionnaire de function calls OpenAI
 * Gère les événements de function calls (response.function_call_arguments.delta, done)
 */
export class FunctionCallHandler {
  constructor(streamSid, callLogger, openAiWs, state) {
    this.streamSid = streamSid;
    this.callLogger = callLogger;
    this.openAiWs = openAiWs;
    this.state = state; // Référence à l'état partagé
  }

  /**
   * Réception de delta d'arguments de function call (streaming).
   * Pas de log par delta pour éviter le spam ; le détail est dans handleFunctionCallCompleted.
   */
  async handleFunctionCallDelta(_data) {
    // NOP : accumulation côté API jusqu'à response.function_call_arguments.done
  }

  /**
   * Function call complété - Exécuter l'appel
   */
  async handleFunctionCallCompleted(data) {
    try {
      if (!this.state.handledFunctionCallIds) {
        this.state.handledFunctionCallIds = new Set();
      }
      if (data.call_id && this.state.handledFunctionCallIds.has(data.call_id)) {
        return;
      }
      if (data.call_id) {
        this.state.handledFunctionCallIds.add(data.call_id);
      }

      // Log brut de la payload JSON envoyée par le modèle
      this.callLogger.info(this.streamSid, "Function call completed (raw payload)", {
        name: data.name,
        callId: data.call_id,
        rawArguments: data.arguments,
      });

      const functionName = data.name;
      const args = JSON.parse(data.arguments || "{}");

      // Logger le JSON parsé pour diagnostic
      this.callLogger.info(this.streamSid, "Function call arguments parsed", {
        functionName,
        parsedArgs: JSON.stringify(args, null, 2),
        commandesCount: args.commandes ? args.commandes.length : 0,
        hasCommandes: Array.isArray(args.commandes) && args.commandes.length > 0,
      });

      let result;

      switch (functionName) {
        case "check_availability":
          result = await FunctionCallService.checkAvailability(args.date);
          break;
        case "create_appointment":
          result = await FunctionCallService.createAppointment(args);
          break;
        default:
          result = { error: `Fonction inconnue: ${functionName}` };
      }

      // Envoyer le résultat à OpenAI puis déclencher la réponse (create_response: false en session)
      if (this.openAiWs && this.openAiWs.readyState === 1) {
        // Log du résultat renvoyé au modèle (JSON vers backend logique)
        this.callLogger.info(this.streamSid, "Function call result ready, sending to OpenAI", {
          functionName,
          callId: data.call_id,
          resultPreview: JSON.stringify(result).substring(0, 500),
        });

        this.openAiWs.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: data.call_id,
              output: JSON.stringify(result),
            },
          })
        );
        // Obligatoire : sans response.create, le modèle ne continue pas (pas de TTS).
        this.openAiWs.send(JSON.stringify({ type: "response.create" }));
        this.callLogger.debug(this.streamSid, "response.create envoyé après function_call_output");
      }
    } catch (error) {
      this.callLogger.error(this.streamSid, error, {
        context: "function_call_execution",
      });
    }
  }
}

