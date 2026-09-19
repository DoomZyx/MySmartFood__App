import { withTenant } from "../../database/transaction.js";
import {
  ensureDefaults,
  ensureDefaultsWithClient,
  loadLegacyPricing,
  persistPricing,
  loadLegacyPricingWithClient,
} from "./MenuCatalogService.js";
import { isOpenNow } from "./AvailabilityService.js";
import * as TenantSettings from "../../models/pg/TenantSettings.js";
import { hoursToLegacy } from "../mappers/pricingMapper.js";
import * as OpeningHours from "../../models/pg/OpeningHours.js";
import {
  getCachedVoiceContext,
  invalidateVoiceContextCache,
  setCachedVoiceContext,
} from "../../utils/voiceContextCache.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DESC_MAX = 80;

function resolveTenantId(instanceId) {
  const id = instanceId != null ? String(instanceId).trim() : "";
  if (!UUID_PATTERN.test(id)) {
    throw new Error("Identifiant d'établissement invalide");
  }
  return id;
}

function isTenantId(instanceId) {
  return UUID_PATTERN.test(String(instanceId || "").trim());
}

/** Menu compact pour le LLM : nom + prix, description courte, sans options lourdes. */
export function packMenuForVoice(menuPricing) {
  const menu = {};
  for (const [slug, category] of Object.entries(menuPricing || {})) {
    const produits = (category.produits || [])
      .filter((item) => item.disponible)
      .map((item) => {
        const packed = {
          nom: item.nom,
          prix: item.prixBase,
        };
        const desc = String(item.description || "").trim();
        if (desc) {
          packed.description =
            desc.length <= DESC_MAX ? desc : `${desc.slice(0, DESC_MAX - 1)}…`;
        }
        return packed;
      });
    if (produits.length === 0) continue;
    menu[slug] = {
      nom: category.nom,
      produits,
    };
  }
  return menu;
}

function buildGptContext(pricing) {
  return {
    restaurantInfo: pricing.restaurantInfo,
    menu: packMenuForVoice(pricing.menuPricing),
    availability: isOpenNow(
      pricing.restaurantInfo?.horairesOuverture,
      pricing.settings?.timezone
    ),
    amenities: pricing.amenities,
    timezone: pricing.settings?.timezone || "Europe/Paris",
  };
}

export class PricingService {
  static async getPricing(instanceId) {
    const tenantId = resolveTenantId(instanceId);
    return loadLegacyPricing(tenantId);
  }

  static async createOrUpdatePricing(pricingData, instanceId) {
    const tenantId = resolveTenantId(pricingData?.instanceId ?? instanceId);
    const result = await withTenant(tenantId, async (client) => {
      const current = await ensureDefaultsWithClient(client, tenantId);
      const restaurantInfo = {
        ...(current.restaurantInfo || {}),
        ...(pricingData.restaurantInfo || {}),
      };
      if (pricingData.restaurantInfo?.horairesOuverture) {
        restaurantInfo.horairesOuverture = {
          ...(current.restaurantInfo?.horairesOuverture || {}),
          ...pricingData.restaurantInfo.horairesOuverture,
        };
      }
      await persistPricing(client, tenantId, {
        ...current,
        ...pricingData,
        restaurantInfo,
        menuPricing: pricingData.menuPricing || current.menuPricing,
      });
      return loadLegacyPricingWithClient(client, tenantId);
    });
    invalidateVoiceContextCache(tenantId);
    return result;
  }

  static async createOrUpdatePricingForInstance(instanceId, defaultConfig) {
    return this.createOrUpdatePricing(defaultConfig, instanceId);
  }

  static async checkAvailability(instanceId) {
    const tenantId = resolveTenantId(instanceId);
    const pricing = await loadLegacyPricing(tenantId);
    return {
      disponible: isOpenNow(pricing.restaurantInfo.horairesOuverture, pricing.settings?.timezone),
      horaires: pricing.restaurantInfo.horairesOuverture,
      restaurantInfo: pricing.restaurantInfo,
    };
  }

  static async getAvailableProducts(category, instanceId) {
    const tenantId = resolveTenantId(instanceId);
    const pricing = await loadLegacyPricing(tenantId);
    const block = pricing.menuPricing[category];
    if (!block) throw new Error("Catégorie non trouvée");
    return {
      categorie: category,
      produits: (block.produits || []).filter((item) => item.disponible),
    };
  }

  static async getPricingForGPT(instanceId) {
    const tenantId = resolveTenantId(instanceId);
    const cached = getCachedVoiceContext(tenantId);
    if (cached) {
      // Horaires / menu caches ; "ouvert maintenant" toujours recalcule.
      return {
        ...cached,
        availability: isOpenNow(
          cached.restaurantInfo?.horairesOuverture,
          cached.timezone
        ),
      };
    }

    const pricing = await ensureDefaults(tenantId);
    const context = buildGptContext(pricing);
    setCachedVoiceContext(tenantId, context);
    return context;
  }

  /**
   * Snapshot leger pour gate mid-call (ouvert + noms produits disponibles).
   * Lit Postgres pour availability / stock a jour (pas le cache menu).
   */
  static async getVoiceSnapshot(instanceId) {
    const tenantId = resolveTenantId(instanceId);
    const pricing = await loadLegacyPricing(tenantId);
    const availability = isOpenNow(
      pricing.restaurantInfo?.horairesOuverture,
      pricing.settings?.timezone
    );
    const products = [];
    for (const [slug, category] of Object.entries(pricing.menuPricing || {})) {
      for (const item of category.produits || []) {
        if (!item.disponible) continue;
        products.push({
          nom: item.nom,
          categorie: slug,
        });
      }
    }
    return {
      availability,
      products,
      restaurantOuvert: availability,
    };
  }

  static async getPhoneLineEnabled(instanceId) {
    if (!isTenantId(instanceId)) return true;
    const tenantId = resolveTenantId(instanceId);
    return withTenant(tenantId, async (client) => {
      const settings = await TenantSettings.find(client, tenantId);
      return settings?.phoneLineEnabled !== false;
    });
  }

  static async updatePhoneLineEnabled(enabled, instanceId) {
    const tenantId = resolveTenantId(instanceId);
    await withTenant(tenantId, (client) =>
      TenantSettings.setPhoneLineEnabled(client, tenantId, enabled)
    );
    invalidateVoiceContextCache(tenantId);
    return this.getPricing(tenantId);
  }

  static async getOpeningHours(instanceId) {
    const tenantId = resolveTenantId(instanceId);
    return withTenant(tenantId, async (client) => {
      const hours = await OpeningHours.list(client, tenantId);
      return hoursToLegacy(hours);
    });
  }
}
