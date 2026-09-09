import OrderModel from "../models/order.js";
import { OrderService } from "../Business/services/OrderService.js";
import logger from "../Services/logging/logger.js";

const DEFAULT_INSTANCE_ID = "inst_default";
function getInstanceId(req) {
  return req.instanceId || DEFAULT_INSTANCE_ID;
}

// Créer une nouvelle commande (sans champ client : commandes à emporter uniquement)
export async function createOrder(request, reply) {
  try {
    const orderData = request.body;
    const instanceId = getInstanceId(request);

    const relatedCall =
      orderData.related_call && String(orderData.related_call).length === 24
        ? orderData.related_call
        : null;
    const order = await OrderModel.create({
      instanceId,
      nom: orderData.nom || null,
      telephone: orderData.telephone || null,
      date: orderData.date,
      heure: orderData.heure,
      commandes: orderData.commandes || [],
      statut: orderData.statut || "confirme",
      createdBy: orderData.createdBy || "manual",
      related_call: relatedCall,
    });

    return reply.code(201).send({
      success: true,
      data: order,
    });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur lors de la création de la commande");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

// Récupérer toutes les commandes
export async function getOrders(request, reply) {
  try {
    const instanceId = getInstanceId(request);
    const { page = 1, limit = 10, statut, type, date, modalite } = request.query;

    // Construire le filtre
    const filter = { instanceId };
    if (statut) filter.statut = statut;
    if (type) filter.type = type;
    if (modalite) filter.modalite = modalite;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      filter.date = { $gte: startDate, $lt: endDate };
    }

    // Calculer la pagination
    const skip = (page - 1) * limit;

    // Récupérer les commandes avec pagination
    const orders = await OrderModel.find(filter)
      .sort({ date: -1, heure: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Compter le total pour la pagination
    const total = await OrderModel.countDocuments(filter);

    return reply.send({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur lors de la récupération des commandes");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

// Récupérer les commandes d'aujourd'hui
export async function getTodayOrders(request, reply) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const instanceId = getInstanceId(request);
    const orders = await OrderModel.find({
      instanceId,
      date: { $gte: today, $lt: tomorrow },
    })
      .sort({ heure: 1 });

    return reply.send({
      success: true,
      data: orders,
    });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur lors de la récupération des commandes du jour");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

// Récupérer une commande par ID
export async function getOrderById(request, reply) {
  try {
    const { id } = request.params;
    const instanceId = getInstanceId(request);

    const order = await OrderModel.findOne({ _id: id, instanceId });

    if (!order) {
      return reply.code(404).send({
        error: "Commande non trouvée",
      });
    }

    return reply.send({
      success: true,
      data: order,
    });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur lors de la récupération de la commande");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

// Mettre à jour une commande
export async function updateOrder(request, reply) {
  try {
    const { id } = request.params;
    const instanceId = getInstanceId(request);
    const updateData = request.body;

    const order = await OrderModel.findOneAndUpdate(
      { _id: id, instanceId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!order) {
      return reply.code(404).send({
        error: "Commande non trouvée",
      });
    }

    return reply.send({
      success: true,
      data: order,
    });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur lors de la mise à jour de la commande");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

// Mettre à jour le statut d'une commande
export async function updateOrderStatus(request, reply) {
  try {
    const { id } = request.params;
    const instanceId = getInstanceId(request);
    const { statut } = request.body;

    const order = await OrderModel.findOneAndUpdate(
      { _id: id, instanceId },
      { statut },
      { new: true, runValidators: true }
    );

    if (!order) {
      return reply.code(404).send({
        error: "Commande non trouvée",
      });
    }

    return reply.send({
      success: true,
      data: order,
    });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur lors de la mise à jour du statut");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

// Supprimer une commande
export async function deleteOrder(request, reply) {
  try {
    const { id } = request.params;
    const instanceId = getInstanceId(request);

    const order = await OrderModel.findOneAndDelete({ _id: id, instanceId });

    if (!order) {
      return reply.code(404).send({
        error: "Commande non trouvée",
      });
    }

    return reply.send({
      success: true,
      message: "Commande supprimée avec succès",
    });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur lors de la suppression de la commande");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

// Vérifier la disponibilité d'un créneau
export async function checkAvailability(request, reply) {
  try {
    const instanceId = getInstanceId(request);
    const { date, heure, duree } = request.query;

    const startTime = new Date(`${date}T${heure}:00`);
    const endTime = new Date(startTime.getTime() + parseInt(duree) * 60000);

    // Vérifier les conflits
    const conflicts = await OrderModel.find({
      instanceId,
      date: { $gte: startTime, $lt: endTime },
      statut: { $nin: ["annule", "termine"] }
    });

    const isAvailable = conflicts.length === 0;

    return reply.send({
      success: true,
      available: isAvailable,
      conflicts: conflicts.length
    });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur lors de la vérification de disponibilité");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

// Obtenir les créneaux disponibles
export async function getAvailableSlots(request, reply) {
  try {
    const { date } = request.query;
    
    const instanceId = getInstanceId(request);
    // Récupérer les horaires depuis la BDD (dynamique)
    const PricingModel = (await import("../models/pricing.js")).default;
    const pricing = await PricingModel.findOne({ instanceId });
    
    if (!pricing || !pricing.restaurantInfo?.horairesOuverture) {
      return reply.code(503).send({
        error: "Horaires non configurés",
        message: "Veuillez configurer les horaires d'ouverture dans la page Configuration"
      });
    }

    // Déterminer le jour de la semaine
    const requestDate = new Date(date);
    const joursFr = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const jour = joursFr[requestDate.getDay()];
    
    const horaire = pricing.restaurantInfo.horairesOuverture[jour];
    
    if (!horaire || !horaire.ouvert) {
      return reply.send({
        success: true,
        availableSlots: [],
        occupiedSlots: [],
        message: "Restaurant fermé ce jour-là"
      });
    }

    // Générer les créneaux de 30 min basés sur les horaires dynamiques
    const slots = [];
    
    // Ajouter les créneaux du midi
    if (horaire.midi?.ouverture && horaire.midi?.fermeture) {
      const [midiStartH, midiStartM] = horaire.midi.ouverture.split(':').map(Number);
      const [midiEndH, midiEndM] = horaire.midi.fermeture.split(':').map(Number);
      
      let currentMinutes = midiStartH * 60 + midiStartM;
      const midiEndMinutes = midiEndH * 60 + midiEndM;
      
      while (currentMinutes < midiEndMinutes) {
        const hours = Math.floor(currentMinutes / 60);
        const minutes = currentMinutes % 60;
        slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
        currentMinutes += 30; // Créneaux de 30 minutes
      }
    }
    
    // Ajouter les créneaux du soir
    if (horaire.soir?.ouverture && horaire.soir?.fermeture) {
      const [soirStartH, soirStartM] = horaire.soir.ouverture.split(':').map(Number);
      const [soirEndH, soirEndM] = horaire.soir.fermeture.split(':').map(Number);
      
      let currentMinutes = soirStartH * 60 + soirStartM;
      const soirEndMinutes = soirEndH * 60 + soirEndM;
      
      while (currentMinutes < soirEndMinutes) {
        const hours = Math.floor(currentMinutes / 60);
        const minutes = currentMinutes % 60;
        slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
        currentMinutes += 30; // Créneaux de 30 minutes
      }
    }

    // Récupérer les créneaux occupés
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const occupiedOrders = await OrderModel.find({
      instanceId,
      date: { $gte: startDate, $lt: endDate },
      statut: { $nin: ["annule", "termine"] }
    });

    // Marquer les créneaux occupés
    const occupiedSlots = occupiedOrders.map(order => order.heure);
    const availableSlots = slots.filter(slot => !occupiedSlots.includes(slot));

    return reply.send({
      success: true,
      availableSlots,
      occupiedSlots
    });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur lors de la récupération des créneaux");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

// Retourne les chiffres du numéro uniquement (pour recherche insensible au format)
function digitsOnly(phone) {
  if (phone == null || phone === "") return "";
  return String(phone).replace(/\D/g, "");
}

// Normalise l'heure en HH:MM (accepte 19h, 19h30, 19:00, 9h30, etc.)
function normalizeTime(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().toLowerCase();
  // Déjà au format HH:MM
  const matchColon = s.match(/^(\d{1,2}):(\d{2})$/);
  if (matchColon) {
    const h = parseInt(matchColon[1], 10);
    const m = parseInt(matchColon[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  // Format 19h, 19h30, 9h00
  const matchH = s.match(/^(\d{1,2})h(\d{0,2})?$/);
  if (matchH) {
    const h = parseInt(matchH[1], 10);
    const m = matchH[2] ? parseInt(matchH[2], 10) : 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  return null;
}

// Normalise la modalité pour correspondre aux valeurs attendues par le modèle
function normalizeModalite(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  
  // Valeurs acceptées par le modèle : ["Sur place", "À emporter", "Livraison"]
  const modaliteMap = {
    "a emporter": "À emporter",
    "à emporter": "À emporter",
    "À emporter": "À emporter",
    "sur place": "Sur place",
    "Sur place": "Sur place",
    "livraison": "Livraison",
    "Livraison": "Livraison"
  };
  
  return modaliteMap[s.toLowerCase()] || null;
}

// Créer une commande à emporter depuis l'IA (uniquement type "Commande à emporter")
export async function createOrderFromAI(request, reply) {
  try {
    const orderData = request.body;

    if (orderData.type === "Réservation de table") {
      return reply.code(400).send({
        error:
          "Pour une réservation, utiliser l'endpoint /api/reservations/ai/create.",
      });
    }

    const rawPhone = String(orderData.clientPhone ?? orderData.telephone ?? "").trim();
    const phoneNormalized = digitsOnly(rawPhone);
    if (phoneNormalized.length < 10) {
      return reply.code(400).send({
        error: "Numéro de téléphone invalide ou manquant.",
      });
    }

    const rawTime = orderData.time ?? orderData.heure ?? "";
    const heureNormalized = normalizeTime(rawTime);
    if (!heureNormalized) {
      return reply.code(400).send({
        error: "Heure invalide ou manquante.",
      });
    }

    const rawDate = orderData.date;
    const orderDate = rawDate ? new Date(rawDate) : null;
    if (!orderDate || isNaN(orderDate.getTime())) {
      return reply.code(400).send({
        error: "Date invalide ou manquante.",
      });
    }

    const instanceId = getInstanceId(request);
    const existing = await OrderService.findRecentOrder({
      instanceId,
      telephone: rawPhone,
      date: orderDate,
      heure: heureNormalized,
    });
    if (existing) {
      return reply.code(200).send({
        success: true,
        data: existing,
        message: "Commande déjà créée",
      });
    }

    const orderToCreate = {
      instanceId,
      nom: (orderData.name || "Client").trim() || null,
      telephone: rawPhone.trim(),
      date: orderDate,
      heure: heureNormalized,
      commandes: orderData.commandes || [],
      statut: "confirme",
      createdBy: "system",
    };

    const order = await OrderModel.create(orderToCreate);

    return reply.code(201).send({
      success: true,
      data: order,
    });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur lors de la création de commande depuis l'IA");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}