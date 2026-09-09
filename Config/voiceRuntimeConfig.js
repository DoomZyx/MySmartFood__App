/**
 * Config runtime pour la voix (WebSocket Twilio → OpenAI Realtime).
 * Mono-déploiement : OPENAI_API_KEY / OPENAI_MODEL / OPENAI_VOICE via .env,
 * prompts et menu via Pricing Mongo (instanceId = INSTANCE_ID).
 */

import PricingModel from "../models/pricing.js";
import { getSystemMessage } from "./prompts.js";
import {
  buildGptPricingFromDoc,
  generateEnrichedPromptWithPricing,
} from "../Services/gptServices/pricingService.js";
import { getSessionUpdatePayload } from "../Services/gptServices/gptServices.js";
import { callLogger } from "../Services/logging/logger.js";

const DEFAULT_INSTANCE_ID = "inst_default";

function resolveInstanceId(instanceId) {
  return instanceId != null && String(instanceId).trim() !== ""
    ? String(instanceId).trim()
    : DEFAULT_INSTANCE_ID;
}

/**
 * @param {string} [instanceId] - Souvent request.instanceId / INSTANCE_ID
 * @returns {Promise<Object>} Même forme que l’ancien instanceConfigLoader (openAi, audio, pricing, …)
 */
export async function getVoiceRuntimeConfig(instanceId) {
  const id = resolveInstanceId(instanceId);
  const pricingDoc = await PricingModel.findOne({ instanceId: id });
  const pricing = pricingDoc ? pricingDoc.toObject() : null;
  const restaurantInfo = pricing?.restaurantInfo || null;
  const basePrompt = getSystemMessage(restaurantInfo);
  const gptPricing = buildGptPricingFromDoc(pricingDoc);
  const enrichedInstructions = generateEnrichedPromptWithPricing(
    basePrompt,
    gptPricing,
  );
  const voice = process.env.OPENAI_VOICE?.trim() || "ballad";
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-realtime-1.5";
  const apiKey = process.env.OPENAI_API_KEY;
  const sessionUpdatePayload = {
    type: "session.update",
    session: getSessionUpdatePayload(voice, enrichedInstructions),
  };
  return {
    instance: { instanceId: id },
    pricing,
    restaurantInfo,
    openAi: {
      apiKey,
      model,
      voice,
      sessionUpdatePayload,
    },
    audio: {
      enableNoiseReduction: process.env.ENABLE_NOISE_REDUCTION !== "false",
    },
    callLogger,
  };
}
