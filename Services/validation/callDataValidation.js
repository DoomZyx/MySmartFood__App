/**
 * Service de validation stricte des données extraites
 * Valide et nettoie les données avant sauvegarde
 */

import { PricingService } from "../../Business/services/PricingService.js";
import { DAYS_FR, splitInTimeZone, weekdayIndexFromYmd } from "../../utils/timeZone.js";
import { resolveRuntimeTenantId } from "../../utils/runtimeTenant.js";
import { withTenant } from "../../database/transaction.js";
import * as TenantSettings from "../../models/pg/TenantSettings.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valide et nettoie un numéro de téléphone
 * @param {string} phone - Numéro de téléphone à valider
 * @returns {string|null} - Numéro nettoyé (10 chiffres) ou null si invalide
 */
export function validatePhone(phone) {
  if (!phone || typeof phone !== "string") {
    return null;
  }

  // Retirer tous les espaces, points, tirets
  const cleaned = phone.replace(/[\s\.\-]/g, "");

  // Vérifier qu'il contient exactement 10 chiffres
  if (!/^\d{10}$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

/**
 * Valide et nettoie une heure au format HH:MM
 * @param {string} time - Heure à valider
 * @returns {string|null} - Heure au format HH:MM ou null si invalide
 */
export function validateTime(time) {
  if (!time || typeof time !== "string") {
    return null;
  }

  const trimmed = time.trim();

  // Si "ASAP", retourner null (pas une heure valide)
  if (trimmed.toUpperCase() === "ASAP") {
    return null;
  }

  // Vérifier le format HH:MM
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Valide qu'une heure est dans les horaires d'ouverture du restaurant (AMEL-007)
 * @param {string} time - Heure à valider (format HH:MM)
 * @param {string} date - Date de la commande (format YYYY-MM-DD ou "ASAP")
 * @returns {Promise<Object>} - { isValid: boolean, adjustedTime: string|null, reason: string }
 */
export async function validateTimeAgainstOpeningHours(time, date = "ASAP", instanceId = null) {
  try {
    if (!time || typeof time !== "string") {
      return {
        isValid: false,
        adjustedTime: null,
        reason: "Heure invalide",
      };
    }

    const tenantId = resolveRuntimeTenantId(instanceId);
    if (!UUID_PATTERN.test(tenantId)) {
      return {
        isValid: true,
        adjustedTime: time,
        reason: "Horaires non configurés",
      };
    }

    const horaires = await PricingService.getOpeningHours(tenantId);
    const timeZone = await withTenant(tenantId, async (client) => {
      const settings = await TenantSettings.find(client, tenantId);
      return settings?.timezone || "Europe/Paris";
    });
    if (!horaires) {
      return {
        isValid: true,
        adjustedTime: time,
        reason: "Horaires non configurés",
      };
    }

    let jour;
    if (date === "ASAP") {
      const now = splitInTimeZone(new Date(), timeZone);
      jour = DAYS_FR[weekdayIndexFromYmd(now.date, timeZone)];
    } else {
      const ymd = String(date).slice(0, 10);
      jour = DAYS_FR[weekdayIndexFromYmd(ymd, timeZone)];
    }

    const horaire = horaires[jour];
    if (!horaire || !horaire.ouvert) {
      return {
        isValid: false,
        adjustedTime: null,
        reason: `Restaurant fermé le ${jour}`,
      };
    }

    const [hours, minutes] = time.split(":").map(Number);
    const timeInMinutes = hours * 60 + minutes;

    // Vérifier si dans la plage midi
    let isValidMidi = false;
    if (horaire.midi?.ouverture && horaire.midi?.fermeture) {
      const [midiStartH, midiStartM] = horaire.midi.ouverture.split(":").map(Number);
      const [midiEndH, midiEndM] = horaire.midi.fermeture.split(":").map(Number);
      const midiStart = midiStartH * 60 + midiStartM;
      const midiEnd = midiEndH * 60 + midiEndM;
      isValidMidi = timeInMinutes >= midiStart && timeInMinutes <= midiEnd;
    }

    // Vérifier si dans la plage soir
    let isValidSoir = false;
    if (horaire.soir?.ouverture && horaire.soir?.fermeture) {
      const [soirStartH, soirStartM] = horaire.soir.ouverture.split(":").map(Number);
      const [soirEndH, soirEndM] = horaire.soir.fermeture.split(":").map(Number);
      const soirStart = soirStartH * 60 + soirStartM;
      const soirEnd = soirEndH * 60 + soirEndM;
      isValidSoir = timeInMinutes >= soirStart && timeInMinutes <= soirEnd;
    }

    if (isValidMidi || isValidSoir) {
      return {
        isValid: true,
        adjustedTime: time,
        reason: "Heure dans les horaires d'ouverture",
      };
    }

    // Si hors horaires, proposer l'heure d'ouverture la plus proche
    let adjustedTime = null;
    if (horaire.midi?.ouverture) {
      adjustedTime = horaire.midi.ouverture;
    } else if (horaire.soir?.ouverture) {
      adjustedTime = horaire.soir.ouverture;
    }

    return {
      isValid: false,
      adjustedTime,
      reason: `Heure hors horaires d'ouverture (${horaire.midi?.ouverture || ""} - ${horaire.midi?.fermeture || ""} / ${horaire.soir?.ouverture || ""} - ${horaire.soir?.fermeture || ""})`,
    };
  } catch (error) {
    return {
      isValid: false,
      adjustedTime: null,
      reason: `Erreur lors de la validation : ${error.message}`,
    };
  }
}

/**
 * Nettoie une string : convertit les strings vides en null
 * @param {any} value - Valeur à nettoyer
 * @returns {string|null} - String non vide ou null
 */
export function cleanString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Valide et nettoie les données extraites d'un appel
 * @param {Object} extractedData - Données brutes extraites par GPT
 * @returns {Object} - Données validées et nettoyées
 */
export function validateCallData(extractedData) {
  const validated = {
    nom: cleanString(extractedData.nom) || "Client inconnu",
    telephone: validatePhone(extractedData.telephone),
    type_demande: cleanString(extractedData.type_demande) || "Autre",
    services: cleanString(extractedData.services) || "Autre",
    description: cleanString(extractedData.description) || "Aucune description fournie",
    statut: cleanString(extractedData.statut) || "nouveau",
    date: new Date(),
    reservation: /** @type {any} */ (null),
    order: /** @type {any} */ (null),
  };

  // Réservation : structure modèle Reservation
  if (extractedData.reservation && typeof extractedData.reservation === "object") {
    const r = extractedData.reservation;
    validated.reservation = {
      nom: cleanString(r.nom) || validated.nom,
      telephone: validated.telephone ? String(validated.telephone).replace(/(\d{2})(?=\d)/g, "$1 ") : "Non fourni",
      date: cleanString(r.date) || "ASAP",
      heure: validateTime(r.heure),
      description: cleanString(r.description) || "",
      nombrePersonnes: typeof r.nombrePersonnes === "number" ? r.nombrePersonnes : 1,
      notes_internes: cleanString(r.notes_internes) || "",
      statut: cleanString(r.statut) || "confirme",
    };
  }

  // Commande à emporter : structure modèle Order
  if (extractedData.order && typeof extractedData.order === "object") {
    const o = extractedData.order;
    validated.order = {
      nom: cleanString(o.nom) || validated.nom,
      telephone: validated.telephone ? String(validated.telephone).replace(/(\d{2})(?=\d)/g, "$1 ") : "Non fourni",
      date: cleanString(o.date) || "ASAP",
      heure: validateTime(o.heure),
      description: cleanString(o.description) || "",
      statut: cleanString(o.statut) || "confirme",
      commandes: Array.isArray(o.commandes) ? o.commandes : [],
    };
  }

  return validated;
}

/**
 * Valide la cohérence entre type_demande et commandes (AMEL-014)
 * @param {string} type_demande - Type de demande
 * @param {Array} commandes - Tableau de commandes
 * @returns {Object} - { isValid: boolean, errors: Array }
 */
export function validateTypeDemandeConsistency(type_demande, commandes) {
  const errors = [];

  if (type_demande === "Commande à emporter" && (!commandes || commandes.length === 0)) {
    errors.push("Type 'Commande à emporter' mais aucune commande trouvée");
  }

  if (type_demande === "Réservation de table" && commandes && commandes.length > 0) {
    // Une réservation peut avoir des commandes, c'est OK
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Génère un rapport de validation avec les erreurs détectées
 * @param {Object} extractedData - Données brutes
 * @param {Object} validatedData - Données validées
 * @returns {Object} - Rapport de validation
 */
export function getValidationReport(extractedData, validatedData) {
  const errors = [];

  // Erreur téléphone
  if (extractedData.telephone && !validatedData.telephone) {
    errors.push({
      field: "telephone",
      original: extractedData.telephone,
      reason: "Numéro invalide (doit contenir exactement 10 chiffres)",
    });
  }

  // Erreur heure (reservation ou order)
  const rawHeure = extractedData.reservation?.heure ?? extractedData.order?.heure;
  const validatedHeure = validatedData.reservation?.heure ?? validatedData.order?.heure;
  if (rawHeure && !validatedHeure) {
    errors.push({
      field: "heure",
      original: rawHeure,
      reason: "Format invalide (doit être HH:MM)",
    });
  }

  // Strings vides converties en null
  const emptyStrings = [];
  if (extractedData.nom && !validatedData.nom) {
    emptyStrings.push("nom");
  }
  if (extractedData.address && !validatedData.address) {
    emptyStrings.push("address");
  }

  return {
    isValid: errors.length === 0,
    errors,
    emptyStringsConverted: emptyStrings,
    originalPhone: extractedData.telephone,
    validatedPhone: validatedData.telephone,
    originalTime: rawHeure,
    validatedTime: validatedHeure,
  };
}

/**
 * Valide les quantités des produits (AMEL-010, AMEL-014)
 * @param {Array} commandes - Tableau de commandes
 * @returns {Object} - { isValid: boolean, errors: Array, correctedCommandes: Array }
 */
export function validateQuantities(commandes) {
  const errors = [];
  const correctedCommandes = [];
  const MIN_QUANTITE = 1;
  const MAX_QUANTITE = 100;

  if (!Array.isArray(commandes)) {
    return {
      isValid: false,
      errors: ["Commandes doit être un tableau"],
      correctedCommandes: [],
    };
  }

  commandes.forEach((commande, index) => {
    let quantite = commande.quantite || 1;

    if (typeof quantite !== "number" || isNaN(quantite)) {
      errors.push(`Commande ${index + 1} (${commande.nom}): Quantité invalide, corrigée à 1`);
      quantite = 1;
    } else if (quantite < MIN_QUANTITE) {
      errors.push(`Commande ${index + 1} (${commande.nom}): Quantité ${quantite} < ${MIN_QUANTITE}, corrigée à ${MIN_QUANTITE}`);
      quantite = MIN_QUANTITE;
    } else if (quantite > MAX_QUANTITE) {
      errors.push(`Commande ${index + 1} (${commande.nom}): Quantité ${quantite} > ${MAX_QUANTITE}, corrigée à ${MAX_QUANTITE}`);
      quantite = MAX_QUANTITE;
    }

    correctedCommandes.push({
      ...commande,
      quantite,
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    correctedCommandes,
  };
}

/**
 * Consolide les produits identiques (même nom + personnalisation) (AMEL-009)
 * @param {Array} commandes - Tableau de commandes
 * @returns {Array} - Tableau de commandes consolidées
 */
export function consolidateProducts(commandes) {
  if (!Array.isArray(commandes) || commandes.length === 0) {
    return [];
  }

  const consolidated = new Map();

  commandes.forEach((commande) => {
    // Créer une clé unique basée sur nom + personnalisation
    const personnalisationKey = commande.personnalisation
      ? JSON.stringify(commande.personnalisation)
      : "null";
    const key = `${commande.nom}::${personnalisationKey}`;

    if (consolidated.has(key)) {
      // Produit déjà présent, additionner les quantités
      const existing = consolidated.get(key);
      existing.quantite += commande.quantite || 1;
    } else {
      // Nouveau produit
      consolidated.set(key, {
        ...commande,
        quantite: commande.quantite || 1,
      });
    }
  });

  return Array.from(consolidated.values());
}

/**
 * Détecte les commandes suspectes (quantité/prix anormaux) (AMEL-012)
 * @param {Array} commandes - Tableau de commandes
 * @returns {Object} - { isSuspicious: boolean, reasons: Array, total: number }
 */
export function detectSuspiciousOrder(commandes) {
  const reasons = [];
  let total = 0;
  let totalQuantite = 0;

  if (!Array.isArray(commandes) || commandes.length === 0) {
    return {
      isSuspicious: false,
      reasons: [],
      total: 0,
    };
  }

  commandes.forEach((commande) => {
    const prix = commande.prixUnitaire || 0;
    const quantite = commande.quantite || 1;
    const sousTotal = prix * quantite;

    total += sousTotal;
    totalQuantite += quantite;
  });

  // Seuils de détection
  const SEUIL_PRIX_TOTAL = 500;
  const SEUIL_QUANTITE_TOTALE = 50;
  const SEUIL_NOMBRE_PRODUITS = 20;

  if (total > SEUIL_PRIX_TOTAL) {
    reasons.push(`Prix total anormalement élevé : ${total.toFixed(2)}€ (seuil: ${SEUIL_PRIX_TOTAL}€)`);
  }

  if (totalQuantite > SEUIL_QUANTITE_TOTALE) {
    reasons.push(`Quantité totale anormalement élevée : ${totalQuantite} (seuil: ${SEUIL_QUANTITE_TOTALE})`);
  }

  if (commandes.length > SEUIL_NOMBRE_PRODUITS) {
    reasons.push(`Nombre de produits anormalement élevé : ${commandes.length} (seuil: ${SEUIL_NOMBRE_PRODUITS})`);
  }

  return {
    isSuspicious: reasons.length > 0,
    reasons,
    total: Math.round(total * 100) / 100,
    totalQuantite,
  };
}

