import WebSocket from "ws";

const OPENAI_TRANSCRIPTION_PROMPT =
  "Transcription d'appels téléphoniques pour restaurant/fast-food en français - MODE HAUTE PRÉCISION.\n\n" +
  "PRIORITÉ - CHIFFRES : Transcris TOUS les chiffres en numérique (0-9), jamais en lettres. Ex: 'deux' → '2', 'trois' → '3'.\n\n" +
  "PRIORITÉ - HEURES : Format HHh ou HHhMM (ex: '18h', '19h30'). Ne JAMAIS transcrire en lettres. 'midi' → '12h', 'minuit' → '00h', 'huit heures' → '8h' (matin) ou '20h' (soir).\n\n" +
  "PRIORITÉ - TÉLÉPHONE : Format XX XX XX XX XX (10 chiffres avec espaces). Ex: 'zéro six soixante-douze...' → '06 72 88 62 55'. Transcris chaque chiffre en numérique.\n\n" +
  "VOCABULAIRE MENU : 'Coca-Cola' (majuscules et tiret), 'burger', 'frites', 'tacos', 'pizza', 'margherita' (avec 'h'), 'sauce Algérienne' (majuscule), 'sauce Samouraï'.\n\n" +
  "RÈGLES HAUTE PRÉCISION : Privilégie justesse chiffres/horaires même avec bruit. Si incertain, transcris quand même. Garde ponctuation naturelle. Respecte majuscules noms propres et produits. Mode haute précision activé.";

const OPENAI_TOOLS = [
  {
    type: "function",
    name: "check_availability",
    description:
      "Vérifier les créneaux disponibles pour une date donnée. La réponse peut contenir remainingCoversMidi et remainingCoversSoir (nombre de places restantes par service). Utilise ces infos pour les réservations : indique au client combien de places restent pour le midi et le soir. IMPORTANT: Il existe 2 services - SERVICE MIDI (11h-15h) et SERVICE SOIR (18h-00h). Chaque commande/réservation appartient à UN seul service.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          format: "date",
          description: "Date souhaitée au format YYYY-MM-DD",
        },
      },
      required: ["date"],
    },
  },
  {
    type: "function",
    name: "create_appointment",
    description:
      "Créer un rendez-vous pour un client. IMPORTANT: Il existe 2 services - SERVICE MIDI (11h-15h) et SERVICE SOIR (18h-00h). Choisis l'heure en fonction du service demandé. Deux structures distinctes : (1) Réservation de table = même base que le modèle Reservation : nombrePersonnes obligatoire, commandes = [] ; (2) Commande à emporter = même base que le modèle Order : commandes = liste des plats.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom complet du client" },
        telephone: {
          type: "string",
          description:
            "Numéro de téléphone au format avec espaces entre paires (ex: 07 86 87 67 89)",
        },
        date: {
          type: "string",
          format: "date",
          description: "Date du rendez-vous au format YYYY-MM-DD",
        },
        time: {
          type: "string",
          pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
          description:
            "Heure du rendez-vous au format HH:MM. SERVICE MIDI: 11h00-14h59, SERVICE SOIR: 18h00-23h59. Exemple: 12h30 pour midi, 19h00 pour soir.",
        },
        duration: {
          type: "integer",
          default: 60,
          description: "Durée en minutes (30, 60, 90, 120)",
        },
        type: {
          type: "string",
          enum: ["Commande à emporter", "Réservation de table"],
          description:
            "Type : commande à emporter ou réservation de table. DOIT être explicitement spécifié.",
        },
        modalite: {
          type: "string",
          enum: ["À emporter", "Sur place", "Livraison"],
          description:
            "Modalite: À emporter si type est Commande à emporter, Sur place si type est Réservation de table, ou Livraison pour livraison",
        },
        description: {
          type: "string",
          description: "Description du rendez-vous",
        },
        nombrePersonnes: {
          type: "integer",
          minimum: 1,
          description:
            "OBLIGATOIRE pour Réservation de table (nombre de couverts). Ne pas remplir pour Commande à emporter.",
        },
        commandes: {
          type: "array",
          description:
            "Réservation : laisser [] (structure Reservation = pas de plats). Commande à emporter : liste des plats (structure Order), chaque élément au minimum 'nom' et 'quantite'.",
          items: {
            type: "object",
            properties: {
              produitId: {
                type: "string",
                description: "ID du produit si disponible",
              },
              nom: {
                type: "string",
                description:
                  "Nom du plat (ex: 'Burger', 'Pizza Margherita', 'Tacos')",
              },
              categorie: {
                type: "string",
                description:
                  "Catégorie du plat (ex: 'Burgers', 'Pizzas', 'Tacos')",
              },
              quantite: {
                type: "integer",
                minimum: 1,
                description: "Quantité commandée",
              },
              prixUnitaire: {
                type: "number",
                description: "Prix unitaire du plat",
              },
              composition: {
                type: "string",
                description:
                  "Composition ou modifications (ex: 'Sans oignons', 'Extra sauce')",
              },
              options: {
                type: "object",
                description: "Options supplémentaires du plat",
              },
            },
            required: ["nom", "quantite"],
          },
        },
      },
      required: ["name", "telephone", "date", "time", "type"],
    },
  },
];

const FALLBACK_REALTIME_MODEL = "gpt-realtime-mini-2025-12-15";

function resolveRealtimeModel(rawModel) {
  if (!rawModel || typeof rawModel !== "string") {
    return FALLBACK_REALTIME_MODEL;
  }
  if (rawModel === "gpt-4o-realtime-mini") {
    return FALLBACK_REALTIME_MODEL;
  }
  return rawModel;
}

/**
 * Construit l'objet session pour session.update (API Realtime GA).
 * Utilisé par voiceRuntimeConfig pour construire session.update (session Realtime).
 */
export function getSessionUpdatePayload(voice = "ballad", instructions = "") {
  const transcriptionPrompt =
    OPENAI_TRANSCRIPTION_PROMPT.length > 1024
      ? OPENAI_TRANSCRIPTION_PROMPT.substring(0, 1024)
      : OPENAI_TRANSCRIPTION_PROMPT;
  return {
    type: "realtime",
    output_modalities: ["audio"],
    instructions,
    max_output_tokens: 812,
    audio: {
      input: {
        format: { type: "audio/pcmu" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.4,
          prefix_padding_ms: 100,
          silence_duration_ms: 150,
          create_response: false,
          interrupt_response: true,
        },
        transcription: {
          model: "whisper-1",
          language: "fr",
          prompt: transcriptionPrompt,
        },
      },
      output: {
        format: { type: "audio/pcmu" },
        voice,
        speed: 1.3,
      },
    },
    tools: OPENAI_TOOLS,
  };
}

/**
 * Crée une session WebSocket OpenAI Realtime.
 * @param {Object} instanceConfig - openAi.apiKey, openAi.model, openAi.sessionUpdatePayload (voir voiceRuntimeConfig)
 */
export function createOpenAiSession(instanceConfig) {
  const apiKey = instanceConfig?.openAi?.apiKey;
  const model = resolveRealtimeModel(instanceConfig?.openAi?.model);
  const sessionUpdatePayload = instanceConfig?.openAi?.sessionUpdatePayload;
  if (!apiKey || !sessionUpdatePayload) {
    throw new Error(
      "createOpenAiSession: instanceConfig.openAi (apiKey, sessionUpdatePayload) requis",
    );
  }

  const ws = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  ws.on("open", () => {
    ws.send(JSON.stringify(sessionUpdatePayload));
  });

  ws.on("error", (error) => {
    console.error("ERREUR OpenAI WebSocket:", error);
    console.error("   - Message:", error.message);
    if ("code" in error) console.error("   - Code:", error.code);
  });

  ws.on("close", () => {});

  return ws;
}
