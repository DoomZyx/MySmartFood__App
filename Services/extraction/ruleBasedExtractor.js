/**
 * Extracteur rule-based de secours pour cas simples
 * Utilisé si GPT échoue
 */

/**
 * Extrait le nom du client avec regex
 * @param {string} transcription - Transcription complète
 * @returns {string} - Nom extrait ou "Client inconnu"
 */
export function extractName(transcription) {
  if (!transcription || typeof transcription !== "string") {
    return "Client inconnu";
  }
  
  const patterns = [
    /(?:je m'appelle|mon nom c'est|nom[:\s]+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:c'est|pour|au nom de|à l'appareil[:\s]+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:monsieur|madame|m\.|mme\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:à quel nom[?]?\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
  ];
  
  for (const pattern of patterns) {
    const match = transcription.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return "Client inconnu";
}

/**
 * Extrait le numéro de téléphone avec regex
 * @param {string} transcription - Transcription complète
 * @returns {string|null} - Téléphone extrait ou null
 */
export function extractPhone(transcription) {
  if (!transcription || typeof transcription !== "string") {
    return null;
  }
  
  // Patterns pour téléphones français
  const patterns = [
    /(?:0[1-9]|(?:\+33\s?[1-9]))[\s\.\-]?(\d{2}[\s\.\-]?\d{2}[\s\.\-]?\d{2}[\s\.\-]?\d{2}[\s\.\-]?\d{2})/g,
    /(\d{2}[\s\.\-]?\d{2}[\s\.\-]?\d{2}[\s\.\-]?\d{2}[\s\.\-]?\d{2})/g
  ];
  
  for (const pattern of patterns) {
    const matches = transcription.match(pattern);
    if (matches && matches.length > 0) {
      // Prendre le premier match et nettoyer
      const phone = matches[0].replace(/[\s\.\-]/g, "");
      if (phone.length === 10) {
        return phone;
      }
    }
  }
  
  return null;
}

/**
 * Extrait l'heure avec regex
 * @param {string} transcription - Transcription complète
 * @returns {string|null} - Heure au format HH:MM ou null
 */
export function extractTime(transcription) {
  if (!transcription || typeof transcription !== "string") {
    return null;
  }
  
  // Patterns pour heures
  const patterns = [
    /(\d{1,2})[hH:]\s?(\d{2})?/g,
    /(?:à|pour)\s+(\d{1,2})[hH](?:\s+(\d{2}))?/g,
    /(\d{1,2}):(\d{2})/g
  ];
  
  for (const pattern of patterns) {
    const matches = [...transcription.matchAll(pattern)];
    if (matches && matches.length > 0) {
      const match = matches[0];
      let hours = parseInt(match[1] || match[2] || 0);
      const minutes = parseInt(match[2] || match[3] || 0);

      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }
  }
  
  // Pattern pour "midi"
  if (transcription.toLowerCase().includes("midi")) {
    return "12:00";
  }
  
  return null;
}

/**
 * Extrait des produits basiques avec matching simple
 * @param {string} transcription - Transcription complète
 * @param {Object} catalog - Catalogue des produits
 * @returns {Array} - Tableau de produits extraits
 */
export function extractBasicProducts(transcription, catalog) {
  if (!transcription || !catalog || !catalog.menu) {
    return [];
  }
  
  const products = [];
  const transcriptionLower = transcription.toLowerCase();
  
  // Chercher des patterns simples
  Object.keys(catalog.menu).forEach(categorie => {
    const category = catalog.menu[categorie];
    if (!category || !category.produits) return;
    
    category.produits.forEach(produit => {
      const nomLower = produit.nom.toLowerCase();
      
      // Chercher le nom du produit dans la transcription
      if (transcriptionLower.includes(nomLower) || 
          transcriptionLower.includes(nomLower.split(' ')[0])) {
        
        // Essayer d'extraire la quantité
        const quantitePattern = new RegExp(`(?:\\d+|une?|deux|trois|quatre|cinq)\\s+${nomLower}`, 'i');
        const quantiteMatch = transcription.match(quantitePattern);
        let quantite = 1;
        
        if (quantiteMatch) {
          const quantiteStr = quantiteMatch[0].toLowerCase();
          if (quantiteStr.includes('deux') || quantiteStr.match(/\b2\b/)) quantite = 2;
          else if (quantiteStr.includes('trois') || quantiteStr.match(/\b3\b/)) quantite = 3;
          else if (quantiteStr.includes('quatre') || quantiteStr.match(/\b4\b/)) quantite = 4;
          else if (quantiteStr.includes('cinq') || quantiteStr.match(/\b5\b/)) quantite = 5;
          else if (quantiteStr.match(/\d+/)) quantite = parseInt(quantiteStr.match(/\d+/)[0]);
        }
        
        products.push({
          nom: produit.nom,
          categorie: categorie,
          quantite: quantite,
          prixUnitaire: produit.prix || 0,
          composition: "",
          personnalisation: null
        });
      }
    });
  });
  
  return products;
}

/**
 * Extraction rule-based complète (fallback si GPT échoue)
 * @param {string} transcription - Transcription complète
 * @param {Object} catalog - Catalogue des produits (optionnel)
 * @returns {Object} - Données extraites au format standard
 */
export function extractWithRules(transcription, catalog = null) {
  if (!transcription || typeof transcription !== "string") {
    return {
      nom: "Client inconnu",
      telephone: null,
      type_demande: "Autre",
      services: "Autre",
      description: "Extraction rule-based - transcription invalide",
      statut: "nouveau",
      order: null
    };
  }
  
  const nom = extractName(transcription);
  const telephone = extractPhone(transcription);
  const heure = extractTime(transcription);
  
  // Détecter type de demande basique
  let type_demande = "Autre";
  let services = "Autre";
  const transcriptionLower = transcription.toLowerCase();
  
  if (transcriptionLower.match(/(?:commander|commande|je veux|je voudrais)/)) {
    type_demande = "Commande à emporter";
  } else if (transcriptionLower.match(/(?:réserver|réservation|table)/)) {
    type_demande = "Réservation de table";
  } else if (transcriptionLower.match(/(?:horaires|ouvert|fermé|heure)/)) {
    type_demande = "Information menu";
  } else if (transcriptionLower.match(/(?:réclamation|plainte|problème)/)) {
    type_demande = "Réclamation";
  }
  
  // Détecter service
  if (transcriptionLower.match(/(?:pizza|pizzas)/)) services = "Pizzas";
  else if (transcriptionLower.match(/(?:burger|burgers)/)) services = "Burgers";
  else if (transcriptionLower.match(/(?:tacos)/)) services = "Tacos";
  else if (transcriptionLower.match(/(?:salade|salades)/)) services = "Salades";
  else if (transcriptionLower.match(/(?:boisson|boissons|soda|coca)/)) services = "Boissons";
  
  // Extraire produits si catalogue disponible
  let commandes = [];
  if (catalog) {
    commandes = extractBasicProducts(transcription, catalog);
  }
  
  // Construire order si produits trouvés ou réservation
  let order = null;
  if (commandes.length > 0 || type_demande === "Réservation de table") {
    order = {
      date: "ASAP",
      heure: heure,
      duree: type_demande === "Réservation de table" ? 90 : 60,
      type: type_demande,
      modalite: transcriptionLower.includes("livraison") ? "Livraison" : 
                transcriptionLower.includes("sur place") ? "Sur place" : "À emporter",
      nombrePersonnes: type_demande === "Réservation de table" ? 
        (transcription.match(/(\d+)\s+personnes?/i)?.[1] || null) : null,
      description: "",
      commandes: commandes
    };
  }
  
  return {
    nom: nom,
    telephone: telephone || "Non fourni",
    type_demande: type_demande,
    services: services,
    description: `Extraction rule-based: ${transcription.substring(0, 100)}...`,
    statut: "nouveau",
    order: order
  };
}




