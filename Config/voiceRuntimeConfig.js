/**
 * Config runtime pour la voix (WebSocket Twilio → OpenAI Realtime).
 */

import { getSystemMessage } from "./prompts.js";
import { generateEnrichedPromptWithPricing } from "../Services/gptServices/pricingService.js";
import { getSessionUpdatePayload } from "../Services/gptServices/gptServices.js";
import { callLogger } from "../Services/logging/logger.js";
import { loadLegacyPricing } from "../Business/services/MenuCatalogService.js";
import { resolveRuntimeTenantId } from "../utils/runtimeTenant.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveInstanceId(instanceId) {
  return resolveRuntimeTenantId(instanceId);
}

export async function getVoiceRuntimeConfig(instanceId) {
  const id = resolveInstanceId(instanceId);
  const pricing = UUID_PATTERN.test(id) ? await loadLegacyPricing(id) : null;
  const restaurantInfo = pricing?.restaurantInfo || null;
  const gptPricing = pricing
    ? {
        restaurantInfo,
        menu: Object.fromEntries(
          Object.entries(pricing.menuPricing || {}).map(([slug, category]) => [
            slug,
            {
              nom: category.nom,
              produits: (category.produits || [])
                .filter((item) => item.disponible)
                .map((item) => ({
                  nom: item.nom,
                  description: item.description,
                  prix: item.prixBase,
                  options: item.options,
                  composition: item.composition,
                })),
            },
          ])
        ),
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
  const model =
    pricing?.settings?.voiceModel ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-realtime-1.5";
  const apiKey = process.env.OPENAI_API_KEY;
  const sessionUpdatePayload = {
    type: "session.update",
    session: getSessionUpdatePayload(voice, enrichedInstructions),
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
