/**
 * Service de validation centralisé pour les produits extraits par GPT
 * Valide les noms, prix, options et personnalisations contre le catalogue
 */

import { PricingService } from "../../Business/services/PricingService.js";
import { callLogger } from "../logging/logger.js";
import { formatOptionChoices, parseChoice } from "../../Business/mappers/menuOptions.js";

function catalogFromPricingDoc(pricingDoc) {
  if (!pricingDoc?.menuPricing) return null;
  const menu = {};
  Object.keys(pricingDoc.menuPricing).forEach((cat) => {
    const block = pricingDoc.menuPricing[cat] || {};
    menu[cat] = {
      nom: block.nom,
      produits: (block.produits || [])
        .filter((p) => p.disponible)
        .map((p) => ({
          nom: p.nom,
          description: p.description,
          prix: p.prixBase,
          disponible: p.disponible,
          options: p.options,
          maxViandes: p.maxViandes,
          personnalisable: p.personnalisable,
        })),
    };
  });
  return { restaurantInfo: pricingDoc.restaurantInfo, menu };
}

async function loadCatalog(instanceId) {
  if (!instanceId) return null;
  try {
    const pricingDoc = await PricingService.getPricing(instanceId);
    return catalogFromPricingDoc(pricingDoc);
  } catch {
    return null;
  }
}

function choiceLabel(entry) {
  return parseChoice(entry).nom;
}

/**
 * Normalise une chaîne pour la comparaison (enlève accents, met en minuscule)
 * @param {string} str - Chaîne à normaliser
 * @returns {string} - Chaîne normalisée
 */
function normalizeString(str) {
  if (!str || typeof str !== "string") {
    return "";
  }

  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Enlève les accents
    .replace(/[^a-z0-9\s]/g, "") // Enlève caractères spéciaux
    .trim();
}

/**
 * Trouve un produit dans le catalogue avec matching flexible
 * @param {string} nomProduit - Nom du produit à chercher
 * @param {string} categorie - Catégorie du produit
 * @param {Object} pricing - Objet pricing contenant le menu
 * @returns {Object|null} - Produit trouvé ou null
 */
function findProductInPricing(nomProduit, categorie, pricing) {
  if (!nomProduit || !categorie || !pricing || !pricing.menu) {
    return null;
  }

  if (!pricing.menu[categorie]) {
    return null;
  }

  const produits = pricing.menu[categorie].produits || [];
  const nomNormalise = normalizeString(nomProduit);

  // 1. Correspondance exacte (case-insensitive)
  let produit = produits.find(
    (p) => p.nom.toLowerCase() === nomProduit.toLowerCase()
  );
  if (produit) {
    return { produit, matchType: "exact" };
  }

  // 2. Correspondance sans accents
  produit = produits.find(
    (p) => normalizeString(p.nom) === nomNormalise
  );
  if (produit) {
    return { produit, matchType: "sans_accents" };
  }

  // 3. Correspondance partielle (le nom recherché contient le nom du produit ou vice versa)
  produit = produits.find(
    (p) =>
      normalizeString(p.nom).includes(nomNormalise) ||
      nomNormalise.includes(normalizeString(p.nom))
  );
  if (produit) {
    return { produit, matchType: "partiel" };
  }

  return null;
}

/**
 * Valide et trouve un produit dans le catalogue
 * @param {string} nomProduit - Nom du produit extrait par GPT
 * @param {string} categorie - Catégorie extraite par GPT
 * @param {string} streamSid - ID du stream pour logging
 * @returns {Promise<Object>} - { isValid: boolean, produit: Object|null, matchType: string, errors: Array }
 */
export async function validateProductName(nomProduit, categorie, streamSid = "unknown", catalog = null) {
  try {
    if (!nomProduit || !categorie) {
      return {
        isValid: false,
        produit: null,
        matchType: null,
        errors: ["Nom de produit ou catégorie manquant"],
      };
    }

    const pricing = catalog || (await loadCatalog());
    if (!pricing) {
      return {
        isValid: false,
        produit: null,
        matchType: null,
        errors: ["Configuration des tarifs non trouvée"],
      };
    }

    const result = findProductInPricing(nomProduit, categorie, pricing);

    if (!result) {
      callLogger.warn(streamSid, "Produit non trouvé dans le catalogue", {
        nomProduit,
        categorie,
        event: "product_not_found",
      });

      return {
        isValid: false,
        produit: null,
        matchType: null,
        errors: [`Produit "${nomProduit}" non trouvé dans la catégorie "${categorie}"`],
      };
    }

    // Vérifier la disponibilité
    if (!result.produit.disponible) {
      callLogger.warn(streamSid, "Produit indisponible", {
        nomProduit,
        categorie,
        event: "product_unavailable",
      });

      return {
        isValid: false,
        produit: result.produit,
        matchType: result.matchType,
        errors: [`Produit "${nomProduit}" est indisponible`],
      };
    }

    // Logger si matching non-exact
    if (result.matchType !== "exact") {
      callLogger.info(streamSid, "Produit trouvé avec matching flexible", {
        nomRecherche: nomProduit,
        nomTrouve: result.produit.nom,
        matchType: result.matchType,
        categorie,
        event: "product_flexible_match",
      });
    }

    return {
      isValid: true,
      produit: result.produit,
      matchType: result.matchType,
      errors: [],
    };
  } catch (error) {
    callLogger.error(streamSid, error, {
      source: "ProductValidationService",
      context: "validateProductName",
      nomProduit,
      categorie,
    });

    return {
      isValid: false,
      produit: null,
      matchType: null,
      errors: [`Erreur lors de la validation : ${error.message}`],
    };
  }
}

/**
 * Valide les personnalisations d'un tacos contre les options disponibles
 * @param {Object} personnalisation - Objet personnalisation extrait par GPT
 * @param {Object} produit - Produit validé du catalogue
 * @param {string} streamSid - ID du stream pour logging
 * @returns {Object} - { isValid: boolean, errors: Array, corrected: Object|null }
 */
export function validateTacosPersonalization(personnalisation, produit, streamSid = "unknown") {
  const errors = [];
  const corrected = personnalisation ? { ...personnalisation } : null;

  if (!personnalisation || !produit) {
    return {
      isValid: true,
      errors: [],
      corrected: null,
    };
  }

  // Vérifier que le produit est personnalisable
  if (!produit.personnalisable) {
    return {
      isValid: true,
      errors: [],
      corrected: null,
    };
  }

  // Vérifier les options disponibles
  if (!produit.options) {
    return {
      isValid: false,
      errors: ["Produit personnalisable mais aucune option disponible"],
      corrected: null,
    };
  }

  // Valider les viandes
  if (personnalisation.viandes && Array.isArray(personnalisation.viandes)) {
    const viandesDisponibles = produit.options.viandes?.choix || [];
    const viandesValides = [];
    const viandesInvalides = [];

    personnalisation.viandes.forEach((viande) => {
      const viandeNormalisee = normalizeString(choiceLabel(viande));
      const viandeTrouvee = viandesDisponibles.find(
        (v) => normalizeString(choiceLabel(v)) === viandeNormalisee
      );

      if (viandeTrouvee) {
        viandesValides.push(choiceLabel(viandeTrouvee));
      } else {
        viandesInvalides.push(choiceLabel(viande) || String(viande));
      }
    });

    if (viandesInvalides.length > 0) {
      errors.push(
        `Viandes invalides : ${viandesInvalides.join(", ")}. Options disponibles : ${formatOptionChoices(viandesDisponibles)}`
      );
    }

    // Vérifier le nombre de viandes vs maxViandes
    if (produit.maxViandes && viandesValides.length > produit.maxViandes) {
      errors.push(
        `Nombre de viandes (${viandesValides.length}) supérieur au maximum autorisé (${produit.maxViandes})`
      );
      // Corriger automatiquement : garder seulement les maxViandes premières
      corrected.viandes = viandesValides.slice(0, produit.maxViandes);
    } else if (viandesValides.length < produit.maxViandes && produit.maxViandes === 1) {
      // Tacos Simple doit avoir exactement 1 viande
      if (viandesValides.length === 0) {
        errors.push("Tacos Simple nécessite exactement 1 viande");
      } else {
        corrected.viandes = [viandesValides[0]];
      }
    } else {
      corrected.viandes = viandesValides;
    }
  }

  // Valider la sauce
  if (personnalisation.sauce) {
    const saucesDisponibles = produit.options.sauces?.choix || [];
    const sauceNormalisee = normalizeString(choiceLabel(personnalisation.sauce));
    const sauceTrouvee = saucesDisponibles.find(
      (s) => normalizeString(choiceLabel(s)) === sauceNormalisee
    );

    if (sauceTrouvee) {
      corrected.sauce = choiceLabel(sauceTrouvee);
    } else {
      errors.push(
        `Sauce invalide : ${personnalisation.sauce}. Options disponibles : ${formatOptionChoices(saucesDisponibles)}`
      );
      if (saucesDisponibles.length > 0) {
        corrected.sauce = choiceLabel(saucesDisponibles[0]);
        callLogger.info(streamSid, "Sauce invalide remplacée par défaut", {
          sauceOriginale: personnalisation.sauce,
          sauceDefaut: corrected.sauce,
          event: "sauce_corrected",
        });
      } else {
        corrected.sauce = null;
      }
    }
  }

  // Valider les ingrédients à exclure (sansIngredients)
  if (personnalisation.sansIngredients && Array.isArray(personnalisation.sansIngredients)) {
    // On accepte tous les sansIngredients (pas de liste stricte généralement)
    corrected.sansIngredients = personnalisation.sansIngredients;
  }

  // Valider les extras
  if (personnalisation.extras && Array.isArray(personnalisation.extras)) {
    // On accepte tous les extras (pas de liste stricte généralement)
    corrected.extras = personnalisation.extras;
  }

  return {
    isValid: errors.length === 0,
    errors,
    corrected: corrected,
  };
}

/**
 * Valide et corrige le prix d'un produit depuis le catalogue
 * @param {string} nomProduit - Nom du produit
 * @param {string} categorie - Catégorie du produit
 * @param {number} prixGPT - Prix extrait par GPT (sera ignoré)
 * @param {string} streamSid - ID du stream pour logging
 * @returns {Promise<Object>} - { prix: number, corrected: boolean }
 */
export async function validateProductPrice(nomProduit, categorie, prixGPT, streamSid = "unknown", catalog = null) {
  try {
    const validation = await validateProductName(nomProduit, categorie, streamSid, catalog);

    if (!validation.isValid || !validation.produit) {
      return {
        prix: prixGPT || 0,
        corrected: false,
        error: "Produit non trouvé, impossible de valider le prix",
      };
    }

    const prixCatalogue = validation.produit.prix || validation.produit.prixBase || 0;

    // Logger si le prix GPT est différent
    if (prixGPT && Math.abs(prixGPT - prixCatalogue) > 0.01) {
      callLogger.warn(streamSid, "Prix GPT différent du catalogue, correction appliquée", {
        nomProduit,
        prixGPT,
        prixCatalogue,
        event: "price_corrected",
      });
    }

    return {
      prix: prixCatalogue,
      corrected: true,
    };
  } catch (error) {
    callLogger.error(streamSid, error, {
      source: "ProductValidationService",
      context: "validateProductPrice",
      nomProduit,
      categorie,
    });

    return {
      prix: prixGPT || 0,
      corrected: false,
      error: error.message,
    };
  }
}

/**
 * Valide tous les produits d'une commande
 * @param {Array} produits - Tableau de produits extraits par GPT
 * @param {string} streamSid - ID du stream pour logging
 * @returns {Promise<Object>} - { validatedProducts: Array, errors: Array, warnings: Array, hasErrors: boolean }
 */
export async function validateAllProducts(produits, streamSid = "unknown", instanceId = null) {
  const validatedProducts = [];
  const errors = [];
  const warnings = [];

  if (!Array.isArray(produits) || produits.length === 0) {
    return {
      validatedProducts: [],
      errors: [],
      warnings: [],
      hasErrors: false,
    };
  }

  const catalog = instanceId ? await loadCatalog(instanceId) : await loadCatalog();

  for (const produit of produits) {
    try {
      // Valider le nom et trouver le produit dans le catalogue
      const nameValidation = await validateProductName(
        produit.nom,
        produit.categorie,
        streamSid,
        catalog
      );

      if (!nameValidation.isValid) {
        errors.push({
          produit: produit.nom,
          categorie: produit.categorie,
          errors: nameValidation.errors,
        });
        // Ne pas inclure le produit invalide dans la commande
        continue;
      }

      // Produit trouvé, créer le produit validé
      const produitValide = {
        nom: nameValidation.produit.nom, // Utiliser le nom exact du catalogue
        categorie: produit.categorie,
        quantite: Math.max(1, Math.min(100, produit.quantite || 1)), // Valider quantité (AMEL-011)
        prixUnitaire: nameValidation.produit.prix || nameValidation.produit.prixBase || 0,
        composition: produit.composition || "",
        personnalisation: null,
        options: produit.options || null,
      };

      // Logger si le nom a été corrigé
      if (nameValidation.matchType !== "exact") {
        warnings.push({
          produit: produit.nom,
          nomCorrige: nameValidation.produit.nom,
          matchType: nameValidation.matchType,
        });
      }

      // Valider le prix (AMEL-002)
      const priceValidation = await validateProductPrice(
        produit.nom,
        produit.categorie,
        produit.prixUnitaire,
        streamSid,
        catalog
      );
      produitValide.prixUnitaire = priceValidation.prix;

      // Valider les personnalisations tacos (AMEL-004)
      if (produit.personnalisation && nameValidation.produit.personnalisable) {
        const personalizationValidation = validateTacosPersonalization(
          produit.personnalisation,
          nameValidation.produit,
          streamSid
        );

        if (personalizationValidation.corrected) {
          produitValide.personnalisation = personalizationValidation.corrected;
        }

        if (personalizationValidation.errors.length > 0) {
          warnings.push({
            produit: produit.nom,
            personalizationErrors: personalizationValidation.errors,
          });
        }
      }

      validatedProducts.push(produitValide);
    } catch (error) {
      callLogger.error(streamSid, error, {
        source: "ProductValidationService",
        context: "validateAllProducts",
        produit: produit.nom,
      });

      errors.push({
        produit: produit.nom,
        categorie: produit.categorie,
        errors: [`Erreur lors de la validation : ${error.message}`],
      });
    }
  }

  return {
    validatedProducts,
    errors,
    warnings,
    hasErrors: errors.length > 0,
  };
}

/**
 * Valide un produit complet (nom, prix, personnalisation, disponibilité)
 * @param {Object} product - Produit extrait par GPT
 * @param {string} streamSid - Stream ID pour logging
 * @returns {Promise<Object>} - {isValid, validatedProduct, errors, warnings}
 */
export async function validateProduct(product, streamSid = "unknown", instanceId = null) {
  const errors = [];
  const warnings = [];
  
  if (!product || !product.nom) {
    return {
      isValid: false,
      validatedProduct: null,
      errors: ["Produit invalide: nom manquant"],
      warnings: []
    };
  }

  const catalog = await loadCatalog(instanceId);
  
  // 1. Valider nom et trouver produit dans catalogue
  const nameValidation = await validateProductName(product.nom, product.categorie, streamSid, catalog);
  
  if (!nameValidation.isValid) {
    return {
      isValid: false,
      validatedProduct: null,
      errors: nameValidation.errors,
      warnings: []
    };
  }
  
  // 2. Recalculer prix depuis catalogue
  const priceValidation = await validateProductPrice(product.nom, product.categorie, product.prixUnitaire, streamSid, catalog);
  
  if (!priceValidation.corrected) {
    errors.push(priceValidation.error || "Impossible de récupérer le prix depuis le catalogue");
  }
  
  // Logger différence prix GPT vs catalogue
  if (product.prixUnitaire && priceValidation.prix && Math.abs(product.prixUnitaire - priceValidation.prix) > 0.01) {
    warnings.push(`Prix GPT (${product.prixUnitaire}€) différent du catalogue (${priceValidation.prix}€) - Prix catalogue utilisé`);
  }
  
  // 3. Valider personnalisation si tacos
  let personnalisationValidee = product.personnalisation;
  if (product.personnalisation && nameValidation.produit) {
    const personalizationValidation = validateTacosPersonalization(
      product.personnalisation,
      nameValidation.produit,
      streamSid
    );
    
    if (!personalizationValidation.isValid) {
      errors.push(...personalizationValidation.errors);
    }
    
    personnalisationValidee = personalizationValidation.corrected;
  }
  
  // Construire produit validé
  const validatedProduct = {
    nom: nameValidation.produit.nom,
    categorie: product.categorie,
    quantite: product.quantite || 1,
    prixUnitaire: priceValidation.prix,
    composition: product.composition || "",
    personnalisation: personnalisationValidee,
    options: product.options || null
  };
  
  return {
    isValid: errors.length === 0,
    validatedProduct,
    errors,
    warnings
  };
}
