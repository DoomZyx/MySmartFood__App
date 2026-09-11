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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export class PricingService {
  static async getPricing(instanceId) {
    const tenantId = resolveTenantId(instanceId);
    return ensureDefaults(tenantId);
  }

  static async createOrUpdatePricing(pricingData, instanceId) {
    const tenantId = resolveTenantId(pricingData?.instanceId ?? instanceId);
    return withTenant(tenantId, async (client) => {
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
    const pricing = await loadLegacyPricing(tenantId);
    const menu = {};
    for (const [slug, category] of Object.entries(pricing.menuPricing || {})) {
      menu[slug] = {
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
      };
    }
    return {
      restaurantInfo: pricing.restaurantInfo,
      menu,
      availability: isOpenNow(pricing.restaurantInfo.horairesOuverture, pricing.settings?.timezone),
      amenities: pricing.amenities,
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
