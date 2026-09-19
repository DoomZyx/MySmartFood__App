/**
 * Config runtime pour la voix (WebSocket Twilio → OpenAI Realtime).
 */

import { getSystemMessage } from "./prompts.js";
import { generateEnrichedPromptWithPricing, packMenuForVoice } from "../Services/gptServices/pricingService.js";
import { getSessionUpdatePayload } from "../Services/gptServices/gptServices.js";
import { callLogger } from "../Services/logging/logger.js";
import { ensureDefaults } from "../Business/services/MenuCatalogService.js";
import { resolveRuntimeTenantId } from "../utils/runtimeTenant.js";
import * as Tenant from "../models/pg/Tenant.js";
import { resolveOpenAiCredentials } from "./openaiModels.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveInstanceId(instanceId) {
  return resolveRuntimeTenantId(instanceId);
}

export async function getVoiceRuntimeConfig(instanceId) {
  const id = resolveInstanceId(instanceId);
  const pricing = UUID_PATTERN.test(id) ? await ensureDefaults(id) : null;
  const restaurantInfo = pricing?.restaurantInfo || null;
  const gptPricing = pricing
    ? {
        restaurantInfo,
        menu: packMenuForVoice(pricing.menuPricing),
        amenities: pricing.amenities,
        settings: pricing.settings,
      }
    : null;
  const basePrompt = getSystemMessage(restaurantInfo);
  const enrichedInstructions = generateEnrichedPromptWithPricing(
    basePrompt,
    gptPricing
  );
  const voice =
    pricing?.settings?.voiceName ||
    process.env.OPENAI_VOICE?.trim() ||
    "ballad";
  const tenant = UUID_PATTERN.test(id) ? await Tenant.findById(id) : null;
  const { apiKey, model } = resolveOpenAiCredentials({
    tenant,
    settings: pricing?.settings,
  });
  const sessionUpdatePayload = {
    type: "session.update",
    session: getSessionUpdatePayload(
      voice,
      enrichedInstructions,
      restaurantInfo?.horairesOuverture,
    ),
  };
  return {
    instance: { instanceId: id },
    pricing: gptPricing,
    restaurantInfo,
    openAi: {
      apiKey,
      model,
      voice,
      sessionUpdatePayload,
    },
    audio: {
      enableNoiseReduction:
        pricing?.settings?.noiseReductionEnabled ??
        process.env.ENABLE_NOISE_REDUCTION !== "false",
    },
    callLogger,
  };
}
