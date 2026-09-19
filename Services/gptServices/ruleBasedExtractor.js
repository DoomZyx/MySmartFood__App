/**
 * Extracteur rule-based de secours
 * Utilisé si GPT échoue complètement pour extraire les données basiques
 * Basé sur regex et patterns simples
 */

/**
 * Extrait un numéro de téléphone depuis la transcription
 * @param {string} transcription - Transcription à analyser
 * @returns {string|null} - Numéro de téléphone ou null
 */
function extractPhone(transcription) {
  // Patterns pour téléphone français (10 chiffres)
  // Formats: 07 86 87 67 89, 0786876789, 07-86-87-67-89, etc.
  const phonePatterns = [
    /0[1-9](?:\s?\d{2}){4}/g, // Format avec espaces: 07 86 87 67 89
    /0[1-9][\s\-\.]?\d{2}[\s\-\.]?\d{2}[\s\-\.]?\d{2}[\s\-\.]?\d{2}/g, // Format flexible
  ];

  for (const pattern of phonePatterns) {
    const matches = transcription.match(pattern);
    if (matches && matches.length > 0) {
      // Prendre le premier match et nettoyer
      const phone = matches[0].replace(/[\s\-\.]/g, '');
      if (phone.length === 10) {
        // Formater avec espaces entre paires
        return phone.match(/.{1,2}/g).join(' ');
      }
    }
  }

  return null;
}

/**
 * Extrait une heure depuis la transcription
 * @param {string} transcription - Transcription à analyser
 * @returns {string|null} - Heure au format HH:MM ou null
 */
function extractTime(transcription) {
  // Patterns pour heures
  const timePatterns = [
    /(\d{1,2})[hH](?:[:\s](\d{2}))?/g, // Format: 19h, 19h30, 19h:30
    /(\d{1,2}):(\d{2})/g, // Format: 19:30
    /midi/gi, // "midi" = 12:00
    /minuit/gi, // "minuit" = 00:00
  ];

  // Chercher "midi" ou "minuit" en premier
  if (/midi/gi.test(transcription)) {
    return "12:00";
  }
  if (/minuit/gi.test(transcription)) {
    return "00:00";
  }

  // Chercher format HH:MM ou HHh
  for (const pattern of timePatterns) {
    const matches = [...transcription.matchAll(pattern)];
    if (matches.length > 0) {
      const match = matches[0];
      let hours = parseInt(match[1], 10);
      let minutes = match[2] ? parseInt(match[2], 10) : 0;

      // Validation
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }
  }

  return null;
}

/**
 * Extrait un nom depuis la transcription
 * @param {string} transcription - Transcription à analyser
 * @returns {string|null} - Nom extrait ou null
 */
function extractName(transcription) {
  // Patterns pour noms
  const namePatterns = [
    /(?:je m'appelle|mon nom c'est|nom[:\s]+|c'est|pour|à quel nom[?\s]+)(?:monsieur|madame|m\.|mme\.?)?\s*([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]+(?:\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]+)?)/gi,
    /(?:monsieur|madame|m\.|mme\.?)\s+([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]+)/gi,
  ];

  for (const pattern of namePatterns) {
    const matches = [...transcription.matchAll(pattern)];
    if (matches.length > 0) {
      // Prendre le dernier match (nom souvent dit en fin)
      const match = matches[matches.length - 1];
      const name = match[1] || match[0];
      if (name && name.length > 2 && name.length < 50) {
        return name.trim();
      }
    }
  }

  return null;
}

/**
 * Détecte le type de demande depuis la transcription
 * @param {string} transcription - Transcription à analyser
 * @returns {string} - Type de demande
 */
function detectTypeDemande(transcription) {
  const lower = transcription.toLowerCase();

  if (/r[ée]serv|table|personnes?/i.test(lower)) {
    return "Réservation de table";
  }
  if (/command|livrai|emporter|pizza|burger|tacos|salade|plat/i.test(lower)) {
    return "Commande à emporter";
  }
  if (/r[ée]clam|probl[èe]me|mauvais|retard/i.test(lower)) {
    return "Réclamation";
  }
  if (/factur|facture|payer|paiement/i.test(lower)) {
    return "Facturation";
  }
  if (/horair|ouvert|ferm|heure|menu|prix|ingr[ée]dient/i.test(lower)) {
    return "Information menu";
  }

  return "Autre";
}

/**
 * Détecte le service depuis la transcription
 * @param {string} transcription - Transcription à analyser
 * @returns {string} - Service
 */
function detectService(transcription) {
  const lower = transcription.toLowerCase();

  if (/pizza/i.test(lower)) return "Pizzas";
  if (/burger/i.test(lower)) return "Burgers";
  if (/tacos/i.test(lower)) return "Tacos";
  if (/salade/i.test(lower)) return "Salades";
  if (/boisson|soda|coca|eau/i.test(lower)) return "Boissons";
  if (/dessert|glace|g[âa]teau/i.test(lower)) return "Desserts";
  if (/menu/i.test(lower)) return "Menus";

  return "Autre";
}

/**
 * Extrait les données basiques depuis la transcription avec règles
 * @param {string} transcription - Transcription à analyser
 * @returns {Object} - Données extraites (format compatible avec extractCallData)
 */
export function extractWithRules(transcription) {
  if (!transcription || transcription.trim().length === 0) {
    return {
      nom: "Client inconnu",
      telephone: "Non fourni",
      type_demande: "Autre",
      services: "Autre",
      description: "Transcription vide",
      statut: "nouveau",
      date: new Date(),
      appointment: null,
      extraction_rule_based: true,
    };
  }

  const phone = extractPhone(transcription);
  const time = extractTime(transcription);
  const name = extractName(transcription);
  const typeDemande = detectTypeDemande(transcription);
  const service = detectService(transcription);

  // Détecter si c'est une commande ou réservation
  let appointment = null;
  if (typeDemande === "Commande à emporter" || typeDemande === "Réservation de table") {
    appointment = {
      date: "ASAP",
      heure: time || null,
      duree: typeDemande === "Réservation de table" ? 90 : 60,
      type: typeDemande,
      modalite: typeDemande === "Réservation de table" ? "Sur place" : "À emporter",
      nombrePersonnes: typeDemande === "Réservation de table" ? null : null,
      description: "",
      commandes: [],
    };
  }

  return {
    nom: name || "Client inconnu",
    telephone: phone || "Non fourni",
    type_demande: typeDemande,
    services: service,
    description: `Extraction rule-based: ${transcription.substring(0, 100)}...`,
    statut: "nouveau",
    date: new Date(),
    appointment,
    extraction_rule_based: true,
  };
}

