import PricingModel from "../../models/pricing.js";
import { PricingService } from "../../Business/services/PricingService.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Même format que getPricingForGPT mais à partir d'un document pricing (ex. déjà filtré par instanceId).
 * Exporté pour usage par voiceRuntimeConfig (prompt enrichi).
 */
export function buildGptPricingFromDoc(pricing) {
  if (!pricing) return null;
  const gptPricing = {
    restaurantInfo: pricing.restaurantInfo,
    menu: {},
    availability: pricing.verifierDisponibilite ? pricing.verifierDisponibilite() : false
  };
  const menuPricing = pricing.menuPricing || {};
  Object.keys(menuPricing).forEach((categorie) => {
    const cat = menuPricing[categorie];
    gptPricing.menu[categorie] = {
      nom: cat.nom,
      produits: (cat.produits || [])
        .filter((p) => p.disponible)
        .map((p) => ({
          nom: p.nom,
          description: p.description,
          prix: p.prixBase,
          options: p.options
        }))
    };
  });
  return gptPricing;
}

// Récupérer les tarifs et les intégrer dans le prompt GPT
export async function getPricingForGPT(instanceId) {
  try {
    const id =
      instanceId != null && String(instanceId).trim() !== ""
        ? String(instanceId).trim()
        : String(process.env.INSTANCE_ID || "").trim();
    if (UUID_PATTERN.test(id)) {
      return await PricingService.getPricingForGPT(id);
    }
    const filter = id ? { instanceId: id } : {};
    const pricing = await PricingModel.findOne(filter);
    if (!pricing) return null;
    return buildGptPricingFromDoc(pricing);
  } catch (error) {
    console.error("Erreur lors de la récupération des tarifs pour GPT:", error);
    return null;
  }
}

/**
 * Génère le prompt enrichi à partir d'un objet pricing déjà au format GPT (restaurantInfo + menu).
 * Utilisé pour éviter un second accès BDD sur le document pricing.
 */
export function generateEnrichedPromptWithPricing(basePrompt, pricing) {
  if (!pricing) return basePrompt;
  let enrichedPrompt = basePrompt;

    // Ajouter les informations du restaurant
    if (pricing.restaurantInfo.nom) {
      enrichedPrompt = enrichedPrompt.replace(
        "{Nom du restaurant}",
        pricing.restaurantInfo.nom
      );
    }

    // Formater les horaires correctement
    const formattedHoraires = Object.entries(pricing.restaurantInfo.horairesOuverture || {})
      .map(([jour, horaire]) => {
        if (!horaire || !horaire.ouvert) {
          return `- ${jour.charAt(0).toUpperCase() + jour.slice(1)} : Fermé`;
        }
        
        const periodes = [];
        if (horaire.midi?.ouverture && horaire.midi?.fermeture) {
          periodes.push(`${horaire.midi.ouverture}-${horaire.midi.fermeture}`);
        }
        if (horaire.soir?.ouverture && horaire.soir?.fermeture) {
          periodes.push(`${horaire.soir.ouverture}-${horaire.soir.fermeture}`);
        }
        
        return `- ${jour.charAt(0).toUpperCase() + jour.slice(1)} : ${periodes.join(' et ')}`;
      })
      .join('\n');

    // Ajouter les informations sur les tarifs
    const pricingInfo = `
========================================
INFORMATIONS DU RESTAURANT :
========================================
Nom : ${pricing.restaurantInfo.nom}
Adresse : ${pricing.restaurantInfo.adresse || "Non renseignée"}
Téléphone : ${pricing.restaurantInfo.telephone || "Non renseigné"}
Email : ${pricing.restaurantInfo.email || "Non renseigné"}

HORAIRES D'OUVERTURE :
${formattedHoraires}

========================================
MENU ET TARIFS :
========================================
IMPORTANT : Tous les prix affichés sont TTC (prix finaux).

MENU :
${Object.keys(pricing.menu).map(categorie => {
  const category = pricing.menu[categorie];
  return `
${category.nom.toUpperCase()} :
${category.produits.map(produit => {
  let productLine = `- ${produit.nom} : ${produit.prix}€ - ${produit.description}`;
  
  // Ajouter les options si elles existent
  if (produit.options && Object.keys(produit.options).length > 0) {
    productLine += '\n  OPTIONS PERSONNALISABLES :';
    Object.entries(produit.options).forEach(([key, optionData]) => {
      productLine += `\n  • ${optionData.nom} : ${optionData.choix.join(', ')}`;
    });
  }
  
  return productLine;
}).join('\n')}`;
}).join('\n')}

========================================
INSTRUCTIONS IMPORTANTES :
========================================
1. Les prix affichés sont les prix finaux TTC
2. Vérifie les horaires d'ouverture avant de confirmer une commande
3. Tu peux donner l'adresse, le téléphone ou l'email si le client le demande
4. Informe le client du délai de préparation estimé

EXEMPLE DE PRISE DE COMMANDE AVEC OPTIONS :
Client : "Je veux un menu tacos double"
Toi : "Quelle viande souhaitez-vous dans le tacos ?"
Client : "Poulet"
Toi : "Et comme sauce ?"
Client : "Samourai"
Toi : "Des crudités ?"
Client : "Oui salade et tomates"
Toi : "Et quelle boisson avec votre menu ?"
Client : "Un coca"
Toi : "Ce sera pour quelle heure ?"
`;

  enrichedPrompt += pricingInfo;
  return enrichedPrompt;
}

// Générer un prompt enrichi avec les tarifs (charge BDD via getPricingForGPT)
export async function generateEnrichedPrompt(basePrompt, instanceId) {
  try {
    const pricing = await getPricingForGPT(instanceId);
    return generateEnrichedPromptWithPricing(basePrompt, pricing);
  } catch (error) {
    console.error("Erreur lors de la génération du prompt enrichi:", error);
    return basePrompt;
  }
}

// Calculer le prix total d'une commande (retourne uniquement TTC)
export async function calculateOrderTotal(orderItems, instanceId) {
  try {
    const filter = instanceId != null && String(instanceId).trim() !== "" ? { instanceId: String(instanceId).trim() } : {};
    const pricingDoc = await PricingModel.findOne(filter);
    if (!pricingDoc) {
      return { total: 0 };
    }

    const pricing = {
      restaurantInfo: pricingDoc.restaurantInfo,
      menu: {}
    };

    // Simplifier le menu pour la recherche
    Object.keys(pricingDoc.menuPricing).forEach(categorie => {
      pricing.menu[categorie] = {
        nom: pricingDoc.menuPricing[categorie].nom,
        produits: pricingDoc.menuPricing[categorie].produits
          .filter(p => p.disponible)
          .map(p => ({
            nom: p.nom,
            description: p.description,
            prix: p.prixBase
          }))
      };
    });

    let total = 0;
    
    // Calculer le total TTC des articles
    orderItems.forEach(item => {
      const product = findProductInPricing(item.nom, item.categorie, pricing);
      if (product) {
        total += product.prix * (item.quantite || 1);
      }
    });

    return {
      total: Math.round(total * 100) / 100
    };
  } catch (error) {
    console.error("Erreur lors du calcul du total:", error);
    return { total: 0 };
  }
}

// Trouver un produit dans la configuration des tarifs
function findProductInPricing(nomProduit, categorie, pricing) {
  try {
    if (!pricing.menu[categorie]) {
      return null;
    }

    return pricing.menu[categorie].produits.find(
      produit => produit.nom.toLowerCase() === nomProduit.toLowerCase()
    );
  } catch (error) {
    console.error("Erreur lors de la recherche du produit:", error);
    return null;
  }
}

// Vérifier la disponibilité d'un produit
export function checkProductAvailability(nomProduit, categorie, pricing) {
  try {
    const product = findProductInPricing(nomProduit, categorie, pricing);
    return product !== null;
  } catch (error) {
    console.error("Erreur lors de la vérification de disponibilité:", error);
    return false;
  }
}

// Obtenir les suggestions de produits similaires
export function getSimilarProducts(nomProduit, categorie, pricing) {
  try {
    if (!pricing.menu[categorie]) {
      return [];
    }

    const searchTerm = nomProduit.toLowerCase();
    return pricing.menu[categorie].produits.filter(produit =>
      produit.nom.toLowerCase().includes(searchTerm) ||
      produit.description.toLowerCase().includes(searchTerm)
    );
  } catch (error) {
    console.error("Erreur lors de la recherche de produits similaires:", error);
    return [];
  }
}

// Fonction utilitaire pour récupérer les infos du restaurant depuis la BDD
export async function getRestaurantInfo(instanceId) {
  const pricing = await getPricingForGPT(instanceId);
  return pricing?.restaurantInfo || null;
}
