import { withTenant } from "../../database/transaction.js";
import * as Menu from "../../models/pg/Menu.js";
import * as OpeningHours from "../../models/pg/OpeningHours.js";
import * as Amenity from "../../models/pg/Amenity.js";
import * as TenantSettings from "../../models/pg/TenantSettings.js";
import * as EstablishmentProfile from "../../models/pg/EstablishmentProfile.js";
import { getDefaultPricingConfig } from "../../Config/defaults/pricingDefaults.js";
import {
  catalogToMenuPricing,
  hoursFromLegacy,
  hoursToLegacy,
  resolveSizeLabel,
  restaurantInfoFromProfile,
} from "../mappers/pricingMapper.js";
import { centsToEuros, eurosToCents, slugify } from "../mappers/legacyStatus.js";
import {
  findCatalogOption,
  parseChoice,
  selectedOptionNames,
} from "../mappers/menuOptions.js";
import { assertProduct, BusinessRuleError } from "../validators/businessRules.js";
import * as TwilioBundle from "../../models/pg/TwilioBundle.js";
import { invalidateVoiceContextCache } from "../../utils/voiceContextCache.js";

export async function loadLegacyPricing(tenantId) {
  return withTenant(tenantId, (client) => loadLegacyPricingWithClient(client, tenantId));
}

export async function loadLegacyPricingWithClient(client, tenantId) {
  // Une seule query à la fois sur le client de transaction (pg@9 interdit le parallèle).
  const profile = await EstablishmentProfile.findByTenantId(tenantId, client);
  const settings = await TenantSettings.find(client, tenantId);
  const hours = await OpeningHours.list(client, tenantId);
  const amenities = await Amenity.listForTenant(client, tenantId);
  const catalog = await Menu.loadCatalog(client, tenantId);
  const bundle = await TwilioBundle.findByTenantId(tenantId);
  const restaurantInfo = restaurantInfoFromProfile(
    profile,
    hoursToLegacy(hours),
    amenities
  );
  return {
    _id: tenantId,
    instanceId: tenantId,
    restaurantInfo,
    menuPricing: catalogToMenuPricing(catalog),
    phoneLineEnabled: settings?.phoneLineEnabled !== false,
    instancePhoneNumber: bundle?.phoneNumber || null,
    settings,
    amenities,
    version: "1.0",
  };
}

export async function ensureDefaultsWithClient(client, tenantId) {
  const settings = await TenantSettings.find(client, tenantId);
  if (!settings) {
    await TenantSettings.upsert(client, tenantId, {});
  }
  await Amenity.ensureDefaults(client, tenantId);
  const existing = await Menu.listCategories(client, tenantId);
  if (existing.length === 0) {
    const defaults = getDefaultPricingConfig();
    const profile = await EstablishmentProfile.findByTenantId(tenantId, client);
    const restaurantInfo = profile
      ? {
          ...defaults.restaurantInfo,
          ...restaurantInfoFromProfile(
            profile,
            defaults.restaurantInfo.horairesOuverture,
            []
          ),
        }
      : defaults.restaurantInfo;
    await persistPricing(client, tenantId, { ...defaults, restaurantInfo });
  } else {
    const hours = await OpeningHours.list(client, tenantId);
    if (hours.length === 0) {
      const defaults = getDefaultPricingConfig();
      await OpeningHours.replaceAll(
        client,
        tenantId,
        hoursFromLegacy(defaults.restaurantInfo.horairesOuverture)
      );
    }
  }
  return loadLegacyPricingWithClient(client, tenantId);
}

export async function ensureDefaults(tenantId) {
  return withTenant(tenantId, (client) => ensureDefaultsWithClient(client, tenantId));
}

export async function persistPricing(client, tenantId, payload) {
  const restaurantInfo = payload.restaurantInfo || {};
  const address = restaurantInfo.adresse || "";
  await EstablishmentProfile.upsert(
    tenantId,
    {
      businessName: restaurantInfo.nom || "Mon Restaurant",
      addressLine: address,
      rawAddress: address,
      postalCode: restaurantInfo.codePostal || "",
      city: restaurantInfo.ville || "",
      country: restaurantInfo.pays || "France",
      phone: restaurantInfo.telephone || "",
      email: restaurantInfo.email || "",
      seatCount: restaurantInfo.nombreCouverts || null,
      cuisineType: restaurantInfo.typeCuisine || null,
      legacyPayload: restaurantInfo,
    },
    client
  );
  await TenantSettings.upsert(client, tenantId, {
    phoneLineEnabled: payload.phoneLineEnabled !== false,
    transferPhone: restaurantInfo.telephone || null,
    timezone: payload.timezone || "Europe/Paris",
    takeawayEnabled: payload.takeawayEnabled !== false,
    reservationEnabled: payload.reservationEnabled !== false,
    legacyPayload: payload.legacyPayload || {},
  });
  if (restaurantInfo.horairesOuverture) {
    await OpeningHours.replaceAll(
      client,
      tenantId,
      hoursFromLegacy(restaurantInfo.horairesOuverture)
    );
  }
  await Amenity.ensureDefaults(client, tenantId);
  if (
    restaurantInfo.accessibilitePmr !== undefined &&
    restaurantInfo.accessibilitePmr !== null
  ) {
    await Amenity.upsert(client, tenantId, {
      slug: "pmr",
      status: restaurantInfo.accessibilitePmr ? "available" : "unavailable",
    });
  }
  if (
    restaurantInfo.nombreChaisesBebe !== undefined &&
    restaurantInfo.nombreChaisesBebe !== null &&
    restaurantInfo.nombreChaisesBebe !== ""
  ) {
    const quantity = Math.max(
      0,
      parseInt(restaurantInfo.nombreChaisesBebe, 10) || 0
    );
    await Amenity.upsert(client, tenantId, {
      slug: "highchair",
      status: quantity > 0 ? "available" : "unavailable",
      quantity,
    });
  }
  if (payload.menuPricing) {
    await replaceMenu(client, tenantId, payload.menuPricing);
  }
  invalidateVoiceContextCache(tenantId);
}

async function replaceMenu(client, tenantId, menuPricing) {
  await client.query(`DELETE FROM menu_option_groups WHERE tenant_id = $1`, [tenantId]);
  await client.query(`DELETE FROM menu_items WHERE tenant_id = $1`, [tenantId]);
  await Menu.replaceCategories(client, tenantId);
  let sort = 0;
  for (const [slug, category] of Object.entries(menuPricing)) {
    const created = await Menu.upsertCategory(client, tenantId, {
      name: category.nom || slug,
      slug,
      sortOrder: sort,
    });
    sort += 1;
    for (const [index, product] of (category.produits || []).entries()) {
      await persistProduct(client, tenantId, created, product, index);
    }
  }
}

export async function persistProduct(client, tenantId, category, product, sortOrder = 0) {
  const baseName = String(product.nom || "").trim() || `produit-${sortOrder + 1}`;
  let name = baseName;
  let item = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await client.query("SAVEPOINT menu_item_insert");
    try {
      item = await Menu.insertItem(client, tenantId, {
        categoryId: category.id,
        name,
        slug: slugify(`${name}-${sortOrder}-${attempt}`),
        description: product.description || "",
        priceCents: eurosToCents(product.prixBase),
        isAvailable: product.disponible !== false,
        sortOrder,
        sizeLabel: resolveSizeLabel(product),
        isCustomizable: Boolean(product.personnalisable),
        maxMeats: product.maxViandes || null,
        includedIngredients: product.ingredientsInclus || {},
        availableIngredients: product.ingredientsDisponibles || {},
        legacyPayload: { ...product, nom: product.nom },
      });
      await client.query("RELEASE SAVEPOINT menu_item_insert");
      break;
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT menu_item_insert");
      if (err.code !== "23505") throw err;
      name = `${baseName} #${attempt + 2}`;
    }
  }
  if (!item) throw new Error(`Impossible d'importer le produit ${baseName}`);
  await persistProductRelations(client, tenantId, item.id, product);
  return item;
}

export async function persistProductRelations(client, tenantId, itemId, product) {
  await Menu.replaceItemGroups(client, tenantId, itemId);
  if (product.options && typeof product.options === "object") {
    let groupSort = 0;
    for (const [slug, optionData] of Object.entries(product.options)) {
      const choix = Array.isArray(optionData)
        ? optionData
        : optionData?.choix || optionData?.options || [];
      const parsedChoices = choix
        .map((entry) => parseChoice(entry))
        .filter((entry) => entry.nom);
      const group = await Menu.upsertOptionGroup(client, tenantId, {
        name: optionData?.nom || slug,
        slug: `${itemId.slice(0, 8)}-${slugify(slug)}`,
        selectionType: optionData?.type === "multiple" || optionData?.max > 1 ? "multiple" : "single",
        minSelect: optionData?.min ?? (optionData?.obligatoire ? 1 : 0),
        maxSelect: optionData?.max || (optionData?.type === "multiple" ? parsedChoices.length || 1 : 1),
        isRequired: Boolean(optionData?.obligatoire),
        sortOrder: groupSort,
        legacyPayload: { ...optionData, slug },
      });
      groupSort += 1;
      await Menu.replaceGroupOptions(
        client,
        tenantId,
        group.id,
        parsedChoices.map((entry, index) => ({
          name: entry.nom,
          priceCents: eurosToCents(entry.prix),
          sortOrder: index,
        }))
      );
      await Menu.linkItemGroup(client, tenantId, itemId, group.id);
    }
  }
  const compositions = [];
  if (product.composition?.platPrincipal) {
    compositions.push({
      role: "plat_principal",
      label: String(product.composition.platPrincipal),
      isChoice: false,
    });
  }
  if (product.boissonsDisponibles?.length) {
    compositions.push({
      role: "boisson",
      label: product.boissonsDisponibles.join(", "),
      isChoice: true,
      legacyPayload: { boissonsDisponibles: product.boissonsDisponibles },
    });
  }
  await Menu.replaceCompositions(client, tenantId, itemId, compositions);
}

export async function addProduct(tenantId, categorySlug, product) {
  assertProduct(product, categorySlug);
  const result = await withTenant(tenantId, async (client) => {
    let category = await Menu.findCategoryBySlug(client, tenantId, categorySlug);
    if (!category) {
      category = await Menu.upsertCategory(client, tenantId, {
        name: categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1),
        slug: categorySlug,
      });
    }
    const item = await persistProduct(client, tenantId, category, product);
    return itemToResponse(item, product);
  });
  invalidateVoiceContextCache(tenantId);
  return result;
}

export async function updateProduct(tenantId, categorySlug, productId, productData) {
  const result = await withTenant(tenantId, async (client) => {
    const existing = await Menu.findItemById(client, tenantId, productId);
    if (!existing) throw new BusinessRuleError("Produit non trouvé", 404);
    const merged = {
      nom: productData.nom || existing.name,
      description: productData.description ?? existing.description,
      prixBase: productData.prixBase ?? centsToEuros(existing.priceCents),
      disponible: productData.disponible ?? existing.isAvailable,
      taille: productData.taille ?? existing.sizeLabel,
      personnalisable: productData.personnalisable ?? existing.isCustomizable,
      maxViandes: productData.maxViandes ?? existing.maxMeats,
      ingredientsInclus: productData.ingredientsInclus || existing.includedIngredients,
      ingredientsDisponibles: productData.ingredientsDisponibles || existing.availableIngredients,
      options: productData.options,
      composition: productData.composition,
      boissonsDisponibles: productData.boissonsDisponibles,
    };
    assertProduct(merged, categorySlug);
    const updated = await Menu.updateItem(client, tenantId, productId, {
      name: merged.nom,
      description: merged.description,
      priceCents: eurosToCents(merged.prixBase),
      isAvailable: Boolean(merged.disponible),
      sizeLabel: merged.taille || null,
      isCustomizable: Boolean(merged.personnalisable),
      maxMeats: merged.maxViandes || null,
      includedIngredients: merged.ingredientsInclus,
      availableIngredients: merged.ingredientsDisponibles,
      legacyPayload: productData,
    });
    if (productData.options !== undefined || productData.composition !== undefined) {
      await persistProductRelations(client, tenantId, productId, merged);
    }
    return itemToResponse(updated, merged);
  });
  invalidateVoiceContextCache(tenantId);
  return result;
}

export async function deleteProduct(tenantId, productId) {
  await withTenant(tenantId, async (client) => {
    const deleted = await Menu.deleteItem(client, tenantId, productId);
    if (!deleted) throw new BusinessRuleError("Produit non trouvé", 404);
  });
  invalidateVoiceContextCache(tenantId);
}

function itemToResponse(item, product) {
  return {
    _id: item.id,
    nom: item.name,
    description: item.description || "",
    prixBase: centsToEuros(item.priceCents),
    disponible: item.isAvailable,
    taille: item.sizeLabel,
    ...product,
  };
}

export async function resolveCatalogPrice(client, tenantId, line) {
  if (!line?.nom && !line?.produitId) {
    throw new BusinessRuleError("Produit de commande invalide");
  }
  const item = line.produitId
    ? await Menu.findItemById(client, tenantId, line.produitId)
    : await Menu.findItemByName(client, tenantId, line.nom);
  if (!item) {
    throw new BusinessRuleError(`Produit introuvable: ${line.nom || line.produitId}`);
  }
  if (!item.isAvailable) {
    throw new BusinessRuleError(`Produit indisponible: ${item.name}`);
  }
  const catalogOptions = await Menu.listItemOptionPrices(client, tenantId, item.id);
  const selectedOptions = {
    ...(line.options || {}),
  };
  if (line.personnalisation && typeof line.personnalisation === "object") {
    if (line.personnalisation.viandes) selectedOptions.viandes = line.personnalisation.viandes;
    if (line.personnalisation.sauce) selectedOptions.sauces = line.personnalisation.sauce;
    if (line.personnalisation.crudites) selectedOptions.crudites = line.personnalisation.crudites;
    if (line.personnalisation.extras) selectedOptions.extras = line.personnalisation.extras;
  }
  const pricedOptions = [];
  let surchargeCents = 0;
  for (const [groupKey, value] of Object.entries(selectedOptions)) {
    for (const optionName of selectedOptionNames(value)) {
      const match = findCatalogOption(catalogOptions, groupKey, optionName);
      const priceCents = match?.priceCents || 0;
      surchargeCents += priceCents;
      pricedOptions.push({
        groupName: match?.groupName || groupKey,
        optionName: match?.optionName || optionName,
        priceCents,
      });
    }
  }
  return {
    menuItemId: item.id,
    label: item.name,
    category: line.categorie || null,
    quantity: Number(line.quantite) || 1,
    unitPriceCents: item.priceCents + surchargeCents,
    composition: line.composition || item.compositionText || null,
    options: pricedOptions.length ? pricedOptions : line.options || {},
  };
}
