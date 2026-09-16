import OpenAI from "openai";
import dotenv from "dotenv";
import { getPricingForGPT } from "./pricingService.js";
import { formatOptionChoices } from "../../Business/mappers/menuOptions.js";
import {
  validateCallData,
  getValidationReport,
  validateTimeAgainstOpeningHours,
  validateTypeDemandeConsistency,
  validateQuantities,
  consolidateProducts,
  detectSuspiciousOrder,
} from "../validation/callDataValidation.js";
import {
  validateAllProducts,
} from "../validation/ProductValidationService.js";
import { callLogger } from "../logging/logger.js";
import {
  recordSuccessfulExtraction,
  recordParsingError,
  recordInvalidPhone,
  recordInvalidTime,
} from "../monitoring/extractionMetrics.js";
import { retryWithBackoff } from "../utils/retryWithBackoff.js";
import { extractWithRules } from "./ruleBasedExtractor.js";
import { FailedExtractionService } from "./failedExtractionService.js";
import circuitBreaker from "./circuitBreaker.js";
import { LlmUsageService } from "../../Business/services/LlmUsageService.js";

dotenv.config();

/** Convertit un objet appointment (fallback rule-based) en reservation + order pour compatibilité. */
function appointmentToReservationOrder(appointment, nom, telephone) {
  if (!appointment || typeof appointment !== "object") {
    return { reservation: null, order: null };
  }
  const base = {
    nom: nom || "Client inconnu",
    telephone: telephone || "Non fourni",
    date: appointment.date || "ASAP",
    heure: appointment.heure || null,
    description: appointment.description || "",
    statut: "confirme",
  };
  if (appointment.type === "Réservation de table") {
    return {
      reservation: { ...base, nombrePersonnes: typeof appointment.nombrePersonnes === "number" ? appointment.nombrePersonnes : 1, notes_internes: "" },
      order: null,
    };
  }
  return {
    reservation: null,
    order: { ...base, commandes: Array.isArray(appointment.commandes) ? appointment.commandes : [] },
  };
}

const openaiFallback = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function resolveExtractionLlm() {
  const vllmBase = String(process.env.VLLM_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const vllmKey = String(process.env.VLLM_API_KEY || "").trim();
  if (vllmBase && vllmKey) {
    return {
      provider: "vllm",
      model: String(process.env.VLLM_MODEL || "restaurant-assistant").trim(),
      client: new OpenAI({ apiKey: vllmKey, baseURL: vllmBase }),
      jsonSchema: false,
    };
  }
  return {
    provider: "openai",
    model: "gpt-4o-mini",
    client: openaiFallback,
    jsonSchema: true,
  };
}

function buildExtractionRequest(llm, enrichedPrompt, transcription) {
  const request = {
    model: llm.model,
    messages: [
      { role: "system", content: enrichedPrompt },
      { role: "user", content: transcription },
    ],
    temperature: 0,
    max_tokens: 2000,
  };
  request.response_format = llm.jsonSchema
    ? {
        type: "json_schema",
        json_schema: {
          name: "call_extraction",
          schema: EXTRACTION_JSON_SCHEMA,
        },
      }
    : { type: "json_object" };
  return request;
}

// Version du prompt pour traçabilité (AMEL-011)
const PROMPT_VERSION = "2.0";

const EXTRACTION_PROMPT = `RÈGLES ABSOLUES - FORMAT JSON UNIQUEMENT 

1. Réponds UNIQUEMENT avec un JSON valide
2. AUCUN texte avant ou après le JSON
3. Guillemets doubles OBLIGATOIRES
4. PAS de virgule finale dans les objets

========================================
TA MISSION :
Extraire les informations d'un appel téléphonique de RESTAURANT
=======================================

Utilise les NOMS EXACTS du menu fourni ci-dessous, pas la transcription brute.

========================================
STRUCTURE JSON À RETOURNER (2 COLLECTIONS DISTINCTES) :
========================================

Une seule des deux clés est renseignée selon le type de demande. L'autre est null.

--- RÉSERVATION DE TABLE → clé "reservation" (structure = modèle Reservation) ---
Si type_demande = "Réservation de table" : renvoyer "reservation" avec la structure du modèle reservation.js.
→ reservation = { nom, telephone, date, heure, description?, nombrePersonnes, notes_internes?, statut? }
→ order = null
Pas de champ "commandes" dans une réservation.

--- COMMANDE À EMPORTER → clé "order" (structure = modèle Order) ---
Si type_demande = "Commande à emporter" : renvoyer "order" avec la structure du modèle order.js.
→ order = { nom, telephone, date, heure, commandes[], statut? }
→ reservation = null
Chaque élément de commandes = { nom, categorie?, quantite, prixUnitaire?, composition?, options? }

Exemple COMMANDE À EMPORTER :
{
  "nom": "Nom du client",
  "telephone": "07 86 87 67 89",
  "type_demande": "Commande à emporter",
  "services": "Pizzas",
  "description": "Description de la demande",
  "statut": "nouveau",
  "reservation": null,
  "order": {
    "nom": "Nom du client",
    "telephone": "07 86 87 67 89",
    "date": "ASAP",
    "heure": "19:00",
    "description": "",
    "statut": "confirme",
    "commandes": [
      { "nom": "Pizza Margherita", "categorie": "Pizzas", "quantite": 2, "prixUnitaire": 12.50, "composition": "+fromage" }
    ]
  }
}

========================================
RÈGLE CRITIQUE : QUAND CRÉER reservation OU order ?
========================================

CRÉER reservation (et order = null) si :
- Le client dit "réserver une table", "réserver pour X personnes", "table pour ce soir"
- Pas de plats commandés, uniquement créneau + nombre de personnes

CRÉER order (et reservation = null) si :
- Le client mentionne UN PLAT (pizza, burger, salade, etc.)
- Le client dit "je veux commander", "à emporter", "livraison"

reservation = null ET order = null si :
- Questions d'horaires uniquement, menu, réclamations sans commande/résa
- "Je regarde le menu", "je vais réfléchir"

SI TU HÉSITES : plat concret mentionné → order ; uniquement table/couverts → reservation

========================================
CHAMPS À EXTRAIRE :
========================================

NOM (nom) - RÈGLE CRITIQUE :
→ CHERCHE LE NOM au millieu ou à la fin de la transcription (milieu, fin)
→ Variantes possibles : "Je m'appelle X", "C'est X", "X à l'appareil", "Pour X", "Nom : X"
→ Si prénom seul (ex: "Martin") : Accepte-le tel quel
→ Si nom complet (ex: "Jean Dupont") : Extrais-le complet
→ Si titre + nom (ex: "Monsieur Martin") : Garde tout
→ Si flou/partiel : "Client" + initiale (ex: "Client M")
→ Si totalement absent : "Client inconnu"

IMPORTANT : Le nom est souvent dit en fin de la conversation, pas au début
Exemple : "Je veux une pizza... oui Martin... pour 19h"
→ Extrais : "Martin"

PATTERNS DE NOM À DÉTECTER :
- "Je m'appelle [NOM]"
- "C'est [NOM]"
- "[NOM] à l'appareil"
- "Monsieur/Madame [NOM]"
- "Pour [NOM]"
- "C'est à quel nom ?" / "À [NOM]"
- "Nom: [NOM]" ou "Mon nom c'est [NOM]"

TÉLÉPHONE (telephone) :
→ Si donné : Extrais-le au format avec espaces entre paires de chiffres (ex: 07 86 87 67 89)
→ Si absent : "Non fourni"
NE JAMAIS inventer un numéro

TYPE_DEMANDE (type_demande) :
Valeurs autorisées UNIQUEMENT :
"Commande à emporter" | "Réservation de table" | "Information menu" | "Réclamation" | "Facturation" | "Autre"

SERVICES (services) :
Valeurs autorisées UNIQUEMENT :
"Pizzas" | "Burgers" | "Salades" | "Plats" | "Tacos" | "Boissons" | "Desserts" | "Menus" | "Promotions" | "Autre"

DESCRIPTION (description) :
→ Résumé clair de la demande du client

STATUT (statut) :
→ Toujours "nouveau"

========================================
OBJET reservation (modèle Reservation) - SI RÉSERVATION DE TABLE :
========================================
Champs : nom, telephone, date, heure, description (optionnel), nombrePersonnes (OBLIGATOIRE), notes_internes (optionnel), statut.
→ date : YYYY-MM-DD ou "ASAP"
→ heure : HH:MM (ex: 20:00). Si ambiguë : "8h" = 20:00 (soir), "midi" = 12:00
→ Pas de champ "commandes"

========================================
OBJET order (modèle Order) - SI COMMANDE À EMPORTER :
========================================
Champs : nom, telephone, date, heure, description (optionnel), commandes[], statut.
→ date : YYYY-MM-DD ou "ASAP"
→ heure : HH:MM. Règles identiques ci-dessus
→ commandes : tableau de plats { nom, categorie?, quantite, prixUnitaire?, composition?, options? }
→ Tableau d'objets pour chaque plat :
{
  "nom": "Nom EXACT du produit tel qu'il apparaît dans le menu",
  "categorie": "Pizzas",
  "quantite": 2,
  "prixUnitaire": 12.50,
  "composition": "+fromage, +oignons",
  "personnalisation": null  // Pour les tacos personnalisés (voir ci-dessous)
}

⚠️ RÈGLE CRITIQUE - NOM DU PRODUIT :
- Utilise le nom EXACT du menu (respect majuscules, variations)
- ATTENTION aux variations : Simple ≠ Double ≠ Triple
- Si client dit "triple tacos" → cherche "Menu Tacos Triple" ou "Tacos Triple"
- Si client dit "double burger" → cherche "Menu Double Burger" ou "Burger Double"
- NE PAS deviner ou simplifier le nom du produit

⚠️ TACOS - CORRESPONDANCE NOMBRE VIANDES :
Le client peut dire le NOMBRE DE VIANDES au lieu du type :
- "1 viande" ou "une viande" = Tacos Simple
- "2 viandes" ou "deux viandes" = Tacos Double
- "3 viandes" ou "trois viandes" = Tacos Triple

Exemples de detection :
- "un menu tacos 3 viandes" → "Menu Tacos Triple"
- "tacos avec 2 viandes" → "Tacos Double"
- "menu tacos une viande" → "Menu Tacos Simple"
- "triple tacos" → "Tacos Triple" (ou "Menu Tacos Triple" si menu)

Tu DOIS faire la conversion automatiquement.

PERSONNALISATION TACOS - RÈGLE OBLIGATOIRE :
Quand le client commande un TACOS, tu DOIS extraire ses choix de viandes et sauces :

Exemple 1 - Tacos Simple (1 viande) :
{
  "nom": "Tacos Simple (1 viande)",
  "categorie": "Tacos",
  "quantite": 1,
  "prixUnitaire": 7.50,
  "composition": "",
  "personnalisation": {
    "viandes": ["Poulet"],  // 1 viande pour un simple
    "sauce": "Algérienne",
    "sansIngredients": [],
    "extras": []
  }
}

Exemple 2 - Tacos Double (2 viandes) :
{
  "nom": "Tacos Double (2 viandes)",
  "categorie": "Tacos",
  "quantite": 1,
  "prixUnitaire": 9.50,
  "composition": "",
  "personnalisation": {
    "viandes": ["Poulet", "Merguez"],  // 2 viandes pour un double
    "sauce": "Sauce Blanche",
    "sansIngredients": ["oignons"],  // Si le client dit "sans X"
    "extras": []
  }
}

IMPORTANT TACOS :
- Tacos Simple = 1 viande → extrais LA viande choisie
- Tacos Double = 2 viandes → extrais LES 2 viandes choisies  
- Tacos Triple = 3 viandes → extrais LES 3 viandes choisies
- TOUJOURS extraire la/les viande(s) et la sauce mentionnées
- Utilise UNIQUEMENT les options disponibles dans le menu (voir ci-dessous)

DETECTION AUTOMATIQUE DU TYPE :
Si tu vois "1 viande"/"une viande" → Utilise "Tacos Simple" dans le nom
Si tu vois "2 viandes"/"deux viandes" → Utilise "Tacos Double" dans le nom
Si tu vois "3 viandes"/"trois viandes" → Utilise "Tacos Triple" dans le nom
Si tu vois "menu" + nombre viandes → Utilise "Menu Tacos [Simple/Double/Triple]"

MENUS - RÈGLE CRITIQUE :
Si le client commande un MENU (ex: "Menu USA Beef Burger", "Menu Tacos Double"), c'est UN SEUL produit.
Le menu INCLUT DEJA : plat + boisson + accompagnement (frites).

→ Extrais le menu comme UN SEUL item dans commandes[] avec le nom exact du menu
→ NE PAS extraire séparément le burger/tacos, la boisson et les frites
→ La boisson choisie va dans le champ "options" comme objet structuré

⚠️ RÈGLE ABSOLUE - BOISSONS DANS LES MENUS :
- Si plusieurs menus sont commandés, CHAQUE menu doit avoir sa boisson dans options
- La boisson est DÉJÀ incluse dans le prix du menu → NE JAMAIS l'ajouter comme produit séparé
- Si le client dit "un menu burger et un coca en plus" → c'est 1 menu (avec boisson dans options) + 1 coca séparé

Exemple Menu simple :
Client dit : "Je veux un menu USA Beef Burger avec un coca"
→ Extrais comme 1 seul item :
{
  "nom": "Menu USA Beef Burger",
  "categorie": "Menus",
  "quantite": 1,
  "prixUnitaire": 15.00,
  "composition": "",
  "options": {
    "boisson": "Coca-Cola"
  }
}

Exemple Plusieurs menus :
Client dit : "Je veux 2 menus burger, un avec coca et l'autre avec sprite"
→ Extrais comme 2 items (un par menu avec sa boisson) :
[
  {
    "nom": "Menu USA Beef Burger",
    "categorie": "Menus",
    "quantite": 1,
    "prixUnitaire": 15.00,
    "options": { "boisson": "Coca-Cola" }
  },
  {
    "nom": "Menu USA Beef Burger",
    "categorie": "Menus",
    "quantite": 1,
    "prixUnitaire": 15.00,
    "options": { "boisson": "Sprite" }
  }
]

Exemple Menu + boisson supplémentaire :
Client dit : "Un menu burger avec coca et un coca en plus"
→ Extrais comme 2 items :
[
  {
    "nom": "Menu USA Beef Burger",
    "categorie": "Menus",
    "quantite": 1,
    "prixUnitaire": 15.00,
    "options": { "boisson": "Coca-Cola" }
  },
  {
    "nom": "Coca-Cola",
    "categorie": "Boissons",
    "quantite": 1,
    "prixUnitaire": 3.00
  }
]

Si le client ne précise pas la boisson, mets "options": null ou "options": { "boisson": "Non précisée" }

Si pas de personnalisation ou produit non-tacos → personnalisation: null

========================================
EXEMPLES CONCRETS :
========================================

Exemple 1 - Commande simple (structure Order) :
Transcription : "Bonjour, je voudrais commander 2 pizzas 4 fromages à emporter"

JSON :
{
  "nom": "Client inconnu",
  "telephone": "07 86 87 67 89",
  "type_demande": "Commande à emporter",
  "services": "Pizzas",
  "description": "Commande de 2 pizzas 4 fromages à emporter",
  "statut": "nouveau",
  "reservation": null,
  "order": {
    "nom": "Client inconnu",
    "telephone": "07 86 87 67 89",
    "date": "ASAP",
    "heure": "ASAP",
    "description": "",
    "statut": "confirme",
    "commandes": [
      { "nom": "Pizza 4 Fromages", "categorie": "Pizzas", "quantite": 2, "prixUnitaire": 12.50, "composition": "" }
    ]
  }
}

Exemple 2 - Réservation (structure Reservation) :
Transcription : "Je m'appelle Dupont, je voudrais réserver pour 4 personnes mardi prochain à 19h"

JSON :
{
  "nom": "Dupont",
  "telephone": "Non fourni",
  "type_demande": "Réservation de table",
  "services": "Autre",
  "description": "Réservation pour 4 personnes",
  "statut": "nouveau",
  "reservation": {
    "nom": "Dupont",
    "telephone": "Non fourni",
    "date": "2025-10-28",
    "heure": "19:00",
    "description": "Réservation 4 personnes",
    "nombrePersonnes": 4,
    "notes_internes": "",
    "statut": "confirme"
  },
  "order": null
}

Exemple 2B - Nom donné au milieu (structure Order) :
Transcription : "Bonjour, je veux commander une pizza Margherita. C'est à quel nom ? Martin. Pour 19h s'il vous plaît."

JSON :
{
  "nom": "Martin",
  "telephone": "Non fourni",
  "type_demande": "Commande à emporter",
  "services": "Pizzas",
  "description": "Commande d'une pizza Margherita pour 19h",
  "statut": "nouveau",
  "reservation": null,
  "order": {
    "nom": "Martin",
    "telephone": "Non fourni",
    "date": "ASAP",
    "heure": "19:00",
    "description": "",
    "statut": "confirme",
    "commandes": [
      { "nom": "Pizza Margherita", "categorie": "Pizzas", "quantite": 1, "prixUnitaire": 12.50, "composition": "" }
    ]
  }
}

Exemple 2C - Nom avec variante (structure Order) :
Transcription : "Oui bonjour, 2 pizzas 4 fromages. Pour Madame Dubois. À emporter."

JSON :
{
  "nom": "Madame Dubois",
  "telephone": "Non fourni",
  "type_demande": "Commande à emporter",
  "services": "Pizzas",
  "description": "Commande de 2 pizzas 4 fromages à emporter",
  "statut": "nouveau",
  "reservation": null,
  "order": {
    "nom": "Madame Dubois",
    "telephone": "Non fourni",
    "date": "ASAP",
    "heure": "ASAP",
    "description": "",
    "statut": "confirme",
    "commandes": [
      { "nom": "Pizza 4 Fromages", "categorie": "Pizzas", "quantite": 2, "prixUnitaire": 12.50, "composition": "" }
    ]
  }
}

Exemple 3 - Correction transcription (structure Order) :
Transcription : "Je veux 2 copoins et un borger avec frittes"

JSON :
{
  "nom": "Client inconnu",
  "telephone": "Non fourni",
  "type_demande": "Commande à emporter",
  "services": "Burgers",
  "description": "Commande de 2 Coca-Cola, 1 burger et frites",
  "statut": "nouveau",
  "reservation": null,
  "order": {
    "nom": "Client inconnu",
    "telephone": "Non fourni",
    "date": "ASAP",
    "heure": "ASAP",
    "description": "",
    "statut": "confirme",
    "commandes": [
      { "nom": "Coca-Cola", "categorie": "Boissons", "quantite": 2, "prixUnitaire": 3.00, "composition": "" },
      { "nom": "USA Beef Burger", "categorie": "Burgers", "quantite": 1, "prixUnitaire": 10.00, "composition": "" },
      { "nom": "Frites", "categorie": "Accompagnements", "quantite": 1, "prixUnitaire": 4.00, "composition": "" }
    ]
  }
}

Exemple 4 - Tacos personnalisé (structure Order) :
Transcription : "Je veux un tacos double. Poulet et merguez. Sauce algérienne. Sans oignons s'il vous plaît. C'est pour Martin."

JSON :
{
  "nom": "Martin",
  "telephone": "Non fourni",
  "type_demande": "Commande à emporter",
  "services": "Tacos",
  "description": "Commande d'un tacos double poulet-merguez sauce algérienne sans oignons",
  "statut": "nouveau",
  "reservation": null,
  "order": {
    "nom": "Martin",
    "telephone": "Non fourni",
    "date": "ASAP",
    "heure": "19:00",
    "description": "",
    "statut": "confirme",
    "commandes": [
      {
        "nom": "Tacos Double (2 viandes)",
        "categorie": "Tacos",
        "quantite": 1,
        "prixUnitaire": 9.50,
        "composition": "",
        "personnalisation": { "viandes": ["Poulet", "Merguez"], "sauce": "Algérienne", "sansIngredients": ["oignons"], "extras": [] }
      }
    ]
  }
}

Exemple 5 - Réservation (structure Reservation) :
Transcription : "Bonjour, je voudrais réserver une table pour 4 personnes ce soir à 20h. C'est Martin, 07 86 87 67 89."

JSON :
{
  "nom": "Martin",
  "telephone": "07 86 87 67 89",
  "type_demande": "Réservation de table",
  "services": "Autre",
  "description": "Réservation table 4 personnes à 20h",
  "statut": "nouveau",
  "reservation": {
    "nom": "Martin",
    "telephone": "07 86 87 67 89",
    "date": "YYYY-MM-DD",
    "heure": "20:00",
    "description": "Réservation 4 personnes",
    "nombrePersonnes": 4,
    "notes_internes": "",
    "statut": "confirme"
  },
  "order": null
}

Exemple 6 - Info uniquement (pas de résa ni commande) :
Transcription : "Vous êtes ouverts jusqu'à quelle heure ?"

JSON :
{
  "nom": "Client inconnu",
  "telephone": "Non fourni",
  "type_demande": "Information menu",
  "services": "Autre",
  "description": "Demande d'informations sur les horaires",
  "statut": "nouveau",
  "reservation": null,
  "order": null
}

Exemple 7 - Réclamation (pas de résa ni commande) :
Transcription : "La livraison a été retardée"

JSON :
{
  "nom": "Client inconnu",
  "telephone": "Non fourni",
  "type_demande": "Réclamation",
  "services": "Autre",
  "description": "Réclamation concernant la livraison",
  "statut": "nouveau",
  "reservation": null,
  "order": null
}
========================================
RAPPEL FINAL - RÈGLES ABSOLUES
========================================

1. JSON valide UNIQUEMENT (pas de texte)

2. NOM DU CLIENT = RÈGLE ABSOLUE - CHERCHE PARTOUT
   → LIS LA TRANSCRIPTION COMPLÈTE (début, milieu, fin)
   → Patterns courants :
     * "Je m'appelle X", "C'est X", "Mon nom c'est X"
     * "Pour X", "Au nom de X", "À quel nom ?" → "X"
     * "Monsieur/Madame X", juste "X" après une question
   → ACCEPTE TOUT : prénom seul (Martin), nom seul (Dupont), les deux
   → ⚠️ Si le GPT vocal demande le nom ET le client répond → TU DOIS L'EXTRAIRE
   → Seulement si VRAIMENT absent ou client refuse = "Client inconnu"

3. Résa → reservation (structure Reservation). Commande → order (structure Order). Un seul des deux non null.

4. Utiliser les NOMS EXACTS du menu (fourni ci-dessous)

5. TÉLÉPHONE absent = "Non fourni" (ne jamais inventer)

6. Date/Heure absentes = "ASAP"

7. Corriger les erreurs de transcription audio

ASTUCE NOM : 
Le nom est RAREMENT dit au début. Cherche dans TOUTE la conversation.
Exemple : "Une pizza... Martin... pour 19h" → Nom = "Martin"

C'est parti !
`;

// Schéma JSON strict : reservation (modèle Reservation) OU order (modèle Order)
const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    nom: { type: ["string", "null"] },
    telephone: { type: ["string", "null"] },
    type_demande: { type: "string" },
    services: { type: "string" },
    description: { type: "string" },
    statut: { type: "string" },
    reservation: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        nom: { type: ["string", "null"] },
        telephone: { type: ["string", "null"] },
        date: { type: "string" },
        heure: { type: ["string", "null"] },
        description: { type: ["string", "null"] },
        nombrePersonnes: { type: "number" },
        notes_internes: { type: ["string", "null"] },
        statut: { type: ["string", "null"] }
      },
      required: ["date", "heure", "nombrePersonnes"]
    },
    order: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        nom: { type: ["string", "null"] },
        telephone: { type: ["string", "null"] },
        date: { type: "string" },
        heure: { type: ["string", "null"] },
        description: { type: ["string", "null"] },
        statut: { type: ["string", "null"] },
        commandes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              nom: { type: "string" },
              categorie: { type: "string" },
              quantite: { type: "number" },
              prixUnitaire: { type: "number" },
              composition: { type: "string" },
              personnalisation: { type: ["object", "null"] },
              options: { type: ["object", "null"] }
            },
            required: ["nom", "quantite"]
          }
        }
      },
      required: ["date", "heure", "commandes"]
    }
  },
  required: ["nom", "telephone", "type_demande", "services", "description", "statut", "reservation", "order"]
};

/**
 * Consolide les produits identiques (même nom + même personnalisation) (AMEL-012)
 * @param {Array} produits - Tableau de produits
 * @returns {Array} - Tableau de produits consolidés
 */
export async function extractCallData(transcription, streamSid = "unknown", instanceId = null) {
  const extractionStartTime = Date.now();
  
  try {
    if (!transcription || transcription.trim().length === 0) {
      throw new Error("Transcription vide ou invalide");
    }

    // Log transcription brute et version du prompt (AMEL-009)
    callLogger.info(streamSid, "Transcription brute reçue pour extraction GPT", {
      transcriptionLength: transcription.length,
      transcriptionPreview: transcription.substring(0, 500) + (transcription.length > 500 ? "..." : ""),
      transcriptionFull: transcription,
      promptVersion: PROMPT_VERSION,
      event: "transcription_raw_for_gpt",
      timestamp: new Date().toISOString()
    });

    // Récupérer le menu configuré
    const pricing = await getPricingForGPT(instanceId);
    let enrichedPrompt = EXTRACTION_PROMPT;

    // Ajouter le menu du restaurant au prompt si disponible
    if (pricing && pricing.menu) {
      const menuInfo = `
========================================
MENU DU RESTAURANT (NOM EXACT DES PRODUITS) :
========================================
⚠️ UTILISE CES NOMS EXACTS - ATTENTION AUX VARIATIONS (Simple/Double/Triple)
Tu dois trouver et utiliser le nom EXACT du produit dans ce menu

${Object.keys(pricing.menu).map(categorie => {
  const category = pricing.menu[categorie];
  return `
${category.nom.toUpperCase()} :
${category.produits.map(produit => {
  let produitStr = `- ${produit.nom}${produit.description ? ` (${produit.description})` : ''} - ${produit.prix}€`;
  
  // Si le produit a des options (tacos), les afficher
  if (produit.options) {
    produitStr += '\n  Options personnalisables :';
    Object.keys(produit.options).forEach(optKey => {
      const option = produit.options[optKey];
      if (option.choix && option.choix.length > 0) {
        produitStr += `\n    ${option.nom}: ${formatOptionChoices(option.choix)}`;
      }
    });
  }
  
  return produitStr;
}).join('\n')}`;
}).join('\n')}

RÈGLE IMPORTANTE : 
Quand le client mentionne un produit, utilise le NOM EXACT du menu ci-dessus dans la description.
Exemples :
- Client dit "un copoin" → Écris "Coca-Cola" ou "Coca" (selon ce qui est au menu)
- Client dit "un borger" → Écris le nom exact du burger commandé (ex: "USA Beef Burger")
- Client dit "une pizaa" → Écris le nom exact de la pizza (ex: "Pizza Margherita")

POUR LES TACOS :
- Utilise les OPTIONS EXACTES affichées ci-dessus
- Si le client précise viandes/sauces/crudités, remplis l'objet "personnalisation"
- Exemples de viandes valides : celles listées dans "Viandes"
- Exemples de sauces valides : celles listées dans "Sauces"
- Exemples de crudités valides : celles listées dans "Crudités"

Si le client ne précise pas le produit exact, utilise les noms génériques mais corrects.
========================================
`;
      enrichedPrompt = EXTRACTION_PROMPT + menuInfo;
    }

    const ref = new Date();
    const ymd = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-${String(ref.getDate()).padStart(2, "0")}`;
    enrichedPrompt += `
========================================
CONTEXTE CALENDRIER (obligatoire)
========================================
La date d'aujourd'hui côté serveur est ${ymd}.
Pour "demain", "après-demain" ou équivalent, calcule la date en YYYY-MM-DD à partir de cette référence.
N'invente pas d'année passée ou fictive : utilise l'année courante du serveur.
`;

    // Vérifier si le circuit breaker est ouvert (OpenAI down)
    if (circuitBreaker.isOpen()) {
      callLogger.warn(streamSid, "Circuit breaker ouvert - Utilisation extracteur rule-based", {
        circuitState: circuitBreaker.getState(),
        event: "circuit_breaker_open",
      });

      // Utiliser extracteur rule-based directement
      const ruleBasedData = extractWithRules(transcription);
      callLogger.info(streamSid, "Extraction rule-based effectuée (fallback)", {
        event: "rule_based_extraction",
      });
      const { reservation, order } = appointmentToReservationOrder(
        ruleBasedData.appointment,
        ruleBasedData.nom,
        ruleBasedData.telephone
      );
      return {
        nom: ruleBasedData.nom,
        telephone: ruleBasedData.telephone || "Non fourni",
        type_demande: ruleBasedData.type_demande,
        services: ruleBasedData.services,
        description: ruleBasedData.description,
        statut: ruleBasedData.statut,
        date: ruleBasedData.date,
        reservation,
        order,
        extraction_rule_based: true,
      };
    }

    // Appel LLM (vLLM Scaleway en priorite, OpenAI sinon)
    let completion;
    let tentatives = 0;
    const llm = resolveExtractionLlm();
    
    try {
      completion = await retryWithBackoff(
        async () => {
          tentatives++;
          return await llm.client.chat.completions.create(
            buildExtractionRequest(llm, enrichedPrompt, transcription),
          );
        },
        {
          maxRetries: 3,
          baseDelay: 1000,
          onRetry: (attempt, error, delay) => {
            callLogger.warn(streamSid, `Tentative ${attempt}/3 d'extraction GPT après erreur`, {
              error: error.message,
              status: error.status || (error.response && error.response.status),
              delay: `${delay}ms`,
              event: "gpt_extraction_retry",
            });

            // Si erreur 429 (rate limit), enregistrer dans circuit breaker
            if (error.status === 429 || (error.response && error.response.status === 429)) {
              circuitBreaker.recordFailure();
            }
          },
        }
      );

      // Succès - enregistrer dans circuit breaker
      circuitBreaker.recordSuccess();
      const usage = completion?.usage;
      if (usage) {
        LlmUsageService.recordFromStream(streamSid, {
          source: "extraction",
          provider: llm.provider,
          model: completion.model || llm.model,
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          latencyMs: Date.now() - extractionStartTime,
        }).catch(() => {});
      }
    } catch (retryError) {
      // Toutes les tentatives ont échoué
      const errorStatus = retryError.status || (retryError.response && retryError.response.status);
      
      callLogger.error(streamSid, new Error("Échec complet de l'extraction GPT après retry"), {
        source: "extractCallData",
        context: "gpt_extraction_failed",
        error: retryError.message,
        status: errorStatus,
        tentatives,
      });

      // Enregistrer l'échec dans le circuit breaker
      circuitBreaker.recordFailure();

      // Sauvegarder la transcription brute pour traitement manuel
      await FailedExtractionService.saveFailedExtraction(
        streamSid,
        transcription,
        retryError,
        tentatives,
        instanceId
      );

      // Si erreur 429 (rate limit) ou erreurs serveur, utiliser fallback rule-based
      if (errorStatus === 429 || errorStatus === 500 || errorStatus === 502 || errorStatus === 503) {
        callLogger.warn(streamSid, "Utilisation extracteur rule-based après échec GPT", {
          errorStatus,
          event: "fallback_rule_based",
        });

        const ruleBasedData = extractWithRules(transcription);
        const { reservation, order } = appointmentToReservationOrder(
          ruleBasedData.appointment,
          ruleBasedData.nom,
          ruleBasedData.telephone
        );
        return {
          nom: ruleBasedData.nom,
          telephone: ruleBasedData.telephone || "Non fourni",
          type_demande: ruleBasedData.type_demande,
          services: ruleBasedData.services,
          description: ruleBasedData.description,
          statut: ruleBasedData.statut,
          date: ruleBasedData.date,
          reservation,
          order,
          extraction_rule_based: true,
        };
      }

      // Re-throw pour que le catch principal gère l'erreur
      throw retryError;
    }

    const rawResponse = completion.choices?.[0]?.message?.content?.trim();

    if (!rawResponse) {
      callLogger.error(streamSid, new Error("Aucune réponse de l'API OpenAI"), {
        source: "extractCallData",
        context: "gpt_no_response",
        completion: JSON.stringify(completion).substring(0, 500),
        event: "gpt_empty_response"
      });
      throw new Error("Aucune réponse de l'API OpenAI");
    }

    // Log réponse brute GPT
    callLogger.info(streamSid, "Réponse brute GPT reçue", {
      event: "gpt_raw_response",
      responseLength: rawResponse.length,
      responsePreview: rawResponse.substring(0, 500) + (rawResponse.length > 500 ? "..." : ""),
      responseFull: rawResponse,
      timestamp: new Date().toISOString()
    });

    // Avec json_schema, la réponse est déjà du JSON valide, pas besoin de nettoyer le markdown
    let extractedData;
    try {
      extractedData = JSON.parse(rawResponse);
    } catch (parseError) {
      recordParsingError();
      callLogger.error(streamSid, new Error("Erreur parsing JSON extrait"), {
        source: "extractCallData",
        context: "json_parsing",
        rawResponse: rawResponse.substring(0, 1000),
        rawResponseFull: rawResponse,
        parseError: parseError.message,
        event: "json_parsing_error"
      });
      throw new Error("Impossible de parser les données extraites");
    }

    // Log JSON extrait avec comparaison transcription
    callLogger.info(streamSid, "JSON extrait par GPT - comparaison avec transcription", {
      event: "json_extracted_comparison",
      extractedData: JSON.stringify(extractedData, null, 2),
      extractedDataCompact: JSON.stringify(extractedData),
      transcriptionOriginal: transcription,
      transcriptionLength: transcription.length,
      extractedDataKeys: Object.keys(extractedData),
      hasReservation: !!extractedData.reservation,
      hasOrder: !!extractedData.order,
      hasCommandes: !!(extractedData.order?.commandes?.length),
      commandesCount: extractedData.order?.commandes?.length || 0,
      nom: extractedData.nom,
      telephone: extractedData.telephone,
      type_demande: extractedData.type_demande,
      timestamp: new Date().toISOString()
    });

    // Vérifier si GPT a retourné une erreur (données non fournies)
    if (extractedData.error) {
      throw new Error(`Extraction impossible : ${extractedData.error}`);
    }

    // ===== VALIDATION DES PRODUITS (AMEL-001 à AMEL-004) =====
    let productsToValidate = [];
    if (extractedData.order?.commandes && Array.isArray(extractedData.order.commandes)) {
      productsToValidate = extractedData.order.commandes;
    }
    
    const productsValidation = await validateAllProducts(productsToValidate, streamSid, instanceId);
    
    // Remplacer les produits extraits par les produits validés
    if (extractedData.order && productsValidation.validatedProducts.length > 0) {
      extractedData.order.commandes = productsValidation.validatedProducts;
    }
    
    // Logger erreurs et warnings produits
    if (productsValidation.hasErrors) {
      callLogger.warn(streamSid, "Erreurs de validation produits", {
        errors: productsValidation.errors,
        event: "product_validation_errors"
      });
    }
    
    if (productsValidation.warnings.length > 0) {
      callLogger.info(streamSid, "Avertissements validation produits", {
        warnings: productsValidation.warnings,
        event: "product_validation_warnings"
      });
    }

    // ===== CONSOLIDATION PRODUITS IDENTIQUES (AMEL-012) =====
    if (extractedData.order?.commandes && Array.isArray(extractedData.order.commandes)) {
      const consolidated = consolidateProducts(extractedData.order.commandes);
      extractedData.order.commandes = consolidated;
      
      if (consolidated.length !== extractedData.order.commandes.length) {
        callLogger.info(streamSid, "Produits consolidés", {
          avant: extractedData.order.commandes.length,
          apres: consolidated.length,
          event: "products_consolidated",
        });
      }
    }


    // ===== VALIDATION STRICTE DES DONNÉES =====
    const validatedData = validateCallData(extractedData);
    const validationReport = getValidationReport(extractedData, validatedData);
    
    // ===== VALIDATION HEURES CONTRE HORAIRES (AMEL-007) =====
    const slotForTime = validatedData.reservation || validatedData.order;
    if (slotForTime?.heure && slotForTime?.date) {
      const timeValidation = await validateTimeAgainstOpeningHours(
        slotForTime.heure,
        slotForTime.date,
        instanceId
      );
      if (!timeValidation.isValid) {
        callLogger.warn(streamSid, "Heure hors horaires d'ouverture", {
          heure: slotForTime.heure,
          date: slotForTime.date,
          reason: timeValidation.reason,
          adjustedTime: timeValidation.adjustedTime,
          event: "time_outside_hours"
        });
        if (timeValidation.adjustedTime) {
          slotForTime.heure = timeValidation.adjustedTime;
        }
      }
    }

    // ===== VALIDATION COHÉRENCE TYPE_DEMANDE (AMEL-014) =====
    const consistencyValidation = validateTypeDemandeConsistency(
      validatedData.type_demande,
      validatedData.order?.commandes || []
    );
    if (!consistencyValidation.isValid) {
      callLogger.warn(streamSid, "Incohérence type_demande vs commandes", {
        type_demande: validatedData.type_demande,
        nombreCommandes: validatedData.order?.commandes?.length || 0,
        errors: consistencyValidation.errors,
        event: "type_demande_inconsistency",
      });
    }

    // Log erreurs de validation et enregistrer métriques
    if (!validationReport.isValid || validationReport.errors.length > 0) {
      callLogger.warn(streamSid, "Erreurs de validation détectées", {
        validationReport,
        event: "validation_errors"
      });

      // Enregistrer les métriques d'erreur
      validationReport.errors.forEach((error) => {
        if (error.field === "telephone") {
          recordInvalidPhone();
        } else if (error.field === "heure") {
          recordInvalidTime();
        }
      });
    }

    // Enregistrer extraction réussie
    recordSuccessfulExtraction();

    // Données pour ProcessCallService : conserver reservation / order (validés)
    const finalData = {
      nom: validatedData.nom,
      telephone: validatedData.telephone || "Non fourni",
      type_demande: validatedData.type_demande,
      services: validatedData.services,
      description: validatedData.description,
      statut: validatedData.statut,
      date: validatedData.date,
      reservation: validatedData.reservation,
      order: validatedData.order,
    };

    const extractionDuration = Date.now() - extractionStartTime;
    callLogger.performance(streamSid, "gpt_extraction", extractionDuration);

    return finalData;

  } catch (error) {
    const extractionDuration = Date.now() - extractionStartTime;
    
    callLogger.error(streamSid, error, {
      source: "extractCallData",
      context: "extraction_error",
      extractionDuration,
    });
    
    // Vérifier si c'est une erreur d'API OpenAI
    if (error.response) {
      callLogger.error(streamSid, new Error("Erreur API OpenAI"), {
        source: "extractCallData",
        context: "openai_api_error",
        status: error.response.status,
        data: error.response.data,
      });
    }

    // En cas d'erreur complète, utiliser extracteur rule-based de secours (AMEL-006)
    callLogger.warn(streamSid, "Erreur extraction GPT, tentative extraction rule-based", {
      error: error.message,
      event: "fallback_to_rule_based_on_error"
    });
    
    try {
      const pricing = await getPricingForGPT(instanceId);
      const fallbackData = extractWithRules(transcription, pricing);
      callLogger.info(streamSid, "Extraction rule-based utilisée après erreur GPT", {
        extractedData: fallbackData,
        event: "rule_based_extraction_used"
      });
      const { reservation, order } = appointmentToReservationOrder(
        fallbackData.appointment,
        fallbackData.nom,
        fallbackData.telephone
      );
      return {
        nom: fallbackData.nom,
        telephone: fallbackData.telephone || "Non fourni",
        type_demande: fallbackData.type_demande,
        services: fallbackData.services,
        description: fallbackData.description,
        statut: fallbackData.statut,
        date: fallbackData.date,
        reservation,
        order,
        extraction_rule_based: true,
      };
    } catch (fallbackError) {
      callLogger.error(streamSid, new Error("Échec extraction rule-based également"), {
        error: fallbackError.message,
        event: "rule_based_extraction_failed"
      });
    }

    return {
      nom: "Client inconnu",
      telephone: "Non fourni",
      type_demande: "Autre",
      services: "Autre",
      description: "Erreur complète d'extraction",
      statut: "nouveau",
      date: new Date(),
      reservation: null,
      order: null
    };
  }
}

