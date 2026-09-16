/**
 * Fallback humain : détection de demande d'humain, seuil d'échecs, transfert Twilio.
 * Utilisé par l'agent vocal pour transférer l'appel vers le numéro saisi dans les infos du restaurant.
 */

import twilio from "twilio";
import { callLogger } from "../Services/logging/logger.js";
import { PhoneLineService } from "../Business/services/PhoneLineService.js";

/** Mots-clés indiquant une demande explicite d'un humain (insensible à la casse) */
const HUMAN_REQUEST_KEYWORDS = [
  "humain",
  "quelqu'un",
  "serveur",
  "patron",
  "responsable",
  "parler a quelqu'un",
  "parler à quelqu'un",
  "je veux quelqu'un",
];

/** Expressions indiquant que l'IA demande de répéter (échec de compréhension) */
const REPEAT_INDICATOR_PHRASES = [
  "répéter",
  "repeter",
  "pas compris",
  "pas bien compris",
  "pouvez-vous répéter",
  "pouvez vous repeter",
  "je n'ai pas compris",
  "je n ai pas compris",
];

/** Phrases : l'IA annonce qu'elle transfère maintenant (pas une question, pas "un instant"). */
const ASSISTANT_TRANSFER_COMMIT = [
  "je vais vous transférer",
  "je vais te transférer",
  "je vous transfère vers",
  "je te transfère vers",
  "je vous mets en relation",
  "l'appel va être transféré",
  "l appel va etre transfere",
];

const FAILURE_THRESHOLD = 3;
const TRANSFER_MESSAGE =
  "Je vais vous transférer vers quelqu'un du restaurant, merci de patienter.";

let twilioClient = null;

function foldFr(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ne garde que les phrases déclaratives. Une offre ("voulez-vous que je transfère ?")
 * ne doit pas déclencher le Dial Twilio.
 */
function declarativeParts(text) {
  const folded = foldFr(text);
  if (!folded) return "";
  if (!folded.includes("?")) return folded;
  return folded
    .split("?")
    .slice(0, -1)
    .concat(folded.endsWith("?") ? [] : [folded.split("?").pop()])
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/\b(voulez[- ]vous|preferez[- ]vous|souhaitez[- ]vous|je peux vous transfer|ou que je transfer)\b/.test(part))
    .join(" ");
}

function getTwilioClient() {
  if (twilioClient) return twilioClient;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
}

/**
 * Détecte si le message utilisateur demande explicitement un humain.
 * @param {string} transcript - Transcription du message utilisateur (peut être vide)
 * @returns {boolean}
 */
export function detectHumanRequest(transcript) {
  if (!transcript || typeof transcript !== "string") return false;
  const normalized = transcript.toLowerCase().trim().replace(/\s+/g, " ");
  if (!normalized) return false;
  for (const keyword of HUMAN_REQUEST_KEYWORDS) {
    if (normalized.includes(keyword)) return true;
  }
  return false;
}

/**
 * Indique si l'état de conversation justifie un transfert (seuil d'échecs atteint).
 * @param {Object} conversationState - État partagé (consecutiveFailures, etc.)
 * @returns {boolean}
 */
export function shouldTransferToHuman(conversationState) {
  if (
    !conversationState ||
    typeof conversationState.consecutiveFailures !== "number"
  )
    return false;
  return conversationState.consecutiveFailures >= FAILURE_THRESHOLD;
}

/**
 * Détecte si le texte de l'assistant annonce un transfert vers un humain (on exécute le transfert Twilio).
 * @param {string} assistantText - Texte de la dernière réponse de l'assistant
 * @returns {boolean}
 */
export function isAssistantTransferIntent(assistantText) {
  if (!assistantText || typeof assistantText !== "string") return false;
  const statements = declarativeParts(assistantText);
  if (!statements) return false;
  return ASSISTANT_TRANSFER_COMMIT.some((phrase) => statements.includes(foldFr(phrase)));
}

/**
 * Détecte si le texte de l'assistant indique une demande de répéter (échec de compréhension).
 * @param {string} assistantText - Texte de la dernière réponse de l'assistant
 * @returns {boolean}
 */
export function isRepeatRequestResponse(assistantText) {
  if (!assistantText || typeof assistantText !== "string") return false;
  const normalized = assistantText.toLowerCase().trim();
  for (const phrase of REPEAT_INDICATOR_PHRASES) {
    if (normalized.includes(phrase)) return true;
  }
  return false;
}

/**
 * Construit le TwiML pour annoncer le transfert et appeler le numéro du restaurant.
 * @param {string|null} restaurantNumber - Numéro E.164 (infos du restaurant)
 * @returns {string} TwiML XML
 */
function buildTransferTwiml(restaurantNumber) {
  const dialNumber = restaurantNumber?.trim() || "";
  if (!dialNumber) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>https://doomzyx.github.io/VoiceTransfert/voiceTransfert.mp3</Play>
  <Say language="fr-FR">Le transfert n'est pas configuré. Merci de rappeler plus tard.</Say>
  <Hangup/>
</Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>https://doomzyx.github.io/VoiceTransfert/voiceTransfert.mp3</Play>
  <Dial><Number>${escapeXmlText(dialNumber)}</Number></Dial>
</Response>`;
}

function escapeXmlText(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Message joué avant raccrochage pour silence prolongé */
const SILENCE_HANGUP_MESSAGE = "Nous n'avons pas détecté de réponse, au revoir.";

/**
 * TwiML pour jouer le message de fin puis raccrocher (silence prolongé).
 * @returns {string} TwiML XML
 */
function buildSilenceHangupTwiml() {
  const text = escapeXmlText(SILENCE_HANGUP_MESSAGE);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="fr-FR">${text}</Say>
  <Hangup/>
</Response>`;
}

/**
 * Raccroche l'appel après silence prolongé : joue un message court puis hangup.
 * @param {string} callSid - SID de l'appel Twilio
 * @returns {Promise<boolean>} true si la mise à jour a été envoyée, false sinon
 */
export async function hangupDueToSilence(callSid) {
  if (!callSid) return false;
  const twiml = buildSilenceHangupTwiml();
  const client = getTwilioClient();
  if (!client) {
    callLogger.warn(null, "Raccrochage silence impossible : Twilio non configuré", {
      callSid,
      event: "SILENCE_HANGUP",
    });
    return false;
  }
  try {
    await client.calls(callSid).update({ twiml });
    callLogger.info(null, "SILENCE_HANGUP", {
      callSid,
      event: "SILENCE_HANGUP",
      message: SILENCE_HANGUP_MESSAGE,
    });
    return true;
  } catch (err) {
    callLogger.error(null, err, {
      callSid,
      event: "SILENCE_HANGUP",
      context: "hangupDueToSilence",
    });
    return false;
  }
}

/**
 * Transfère l'appel vers le numéro du restaurant (TwiML Say + Dial).
 * Log l'événement TRANSFER_TO_HUMAN_TRIGGERED.
 * @param {string} callSid - SID de l'appel Twilio
 * @param {string} transcript - Dernière transcription ou contexte (pour le log)
 * @param {"human_request"|"ai_failure"|"conversation_blocked"|"ai_transfer_intent"} reason - Raison du transfert
 * @returns {Promise<boolean>} true si le transfert a été envoyé, false sinon
 */
export async function transferToHuman(callSid, transcript, reason, instanceId) {
  if (!callSid) return false;
  const transferNumber = await PhoneLineService.getTransferNumber(instanceId);
  const twiml = buildTransferTwiml(transferNumber);
  const client = getTwilioClient();
  if (!client) {
    callLogger.warn(
      null,
      "Transfert humain impossible : Twilio non configuré",
      {
        callSid,
        reason,
        event: "TRANSFER_TO_HUMAN_TRIGGERED",
      },
    );
    return false;
  }
  try {
    await client.calls(callSid).update({ twiml });
    callLogger.info(null, "TRANSFER_TO_HUMAN_TRIGGERED", {
      callSid,
      transcript:
        typeof transcript === "string" ? transcript.substring(0, 500) : "",
      reason,
      event: "TRANSFER_TO_HUMAN_TRIGGERED",
    });
    return true;
  } catch (err) {
    callLogger.error(null, err, {
      callSid,
      reason,
      event: "TRANSFER_TO_HUMAN_TRIGGERED",
      context: "transferToHuman",
    });
    return false;
  }
}
