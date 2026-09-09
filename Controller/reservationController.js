import ReservationModel from "../models/reservation.js";
import { OrderService } from "../Business/services/OrderService.js";
import logger from "../Services/logging/logger.js";

const DEFAULT_INSTANCE_ID = "inst_default";
function getInstanceId(req) {
  return req.instanceId || DEFAULT_INSTANCE_ID;
}

function digitsOnly(phone) {
  if (phone == null || phone === "") return "";
  return String(phone).replace(/\D/g, "");
}

function normalizeTime(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().toLowerCase();
  const matchColon = s.match(/^(\d{1,2}):(\d{2})$/);
  if (matchColon) {
    const h = parseInt(matchColon[1], 10);
    const m = parseInt(matchColon[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
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

/** Créer une réservation (manuel) */
export async function createReservation(request, reply) {
  try {
    const data = request.body;
    const instanceId = getInstanceId(request);
    const relatedCall =
      data.related_call && String(data.related_call).length === 24 ? data.related_call : null;
    const reservation = await ReservationModel.create({
      instanceId,
      nom: data.nom || null,
      telephone: data.telephone || null,
      date: data.date,
      heure: data.heure,
      description: data.description || "",
      nombrePersonnes: data.nombrePersonnes ?? 1,
      notes_internes: data.notes_internes || "",
      statut: data.statut || "confirme",
      createdBy: data.createdBy || "manual",
      related_call: relatedCall,
    });
    return reply.code(201).send({ success: true, data: reservation });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur création réservation");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

/** Récupérer les réservations avec filtres et pagination */
export async function getReservations(request, reply) {
  try {
    const instanceId = getInstanceId(request);
    const { page = 1, limit = 10, statut, date } = request.query;
    const filter = { instanceId };
    if (statut) filter.statut = statut;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      filter.date = { $gte: startDate, $lt: endDate };
    }
    const skip = (page - 1) * limit;
    const reservations = await ReservationModel.find(filter)
      .sort({ date: -1, heure: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await ReservationModel.countDocuments(filter);
    return reply.send({
      success: true,
      data: reservations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur récupération réservations");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

/** Récupérer les réservations du jour */
export async function getTodayReservations(request, reply) {
  try {
    const instanceId = getInstanceId(request);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const reservations = await ReservationModel.find({
      instanceId,
      date: { $gte: today, $lt: tomorrow },
    }).sort({ heure: 1 });
    return reply.send({ success: true, data: reservations });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur réservations du jour");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

/** Récupérer une réservation par ID */
export async function getReservationById(request, reply) {
  try {
    const { id } = request.params;
    const instanceId = getInstanceId(request);
    const reservation = await ReservationModel.findOne({ _id: id, instanceId });
    if (!reservation) {
      return reply.code(404).send({ error: "Réservation non trouvée" });
    }
    return reply.send({ success: true, data: reservation });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur récupération réservation");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

/** Mettre à jour une réservation */
export async function updateReservation(request, reply) {
  try {
    const { id } = request.params;
    const instanceId = getInstanceId(request);
    const updateData = request.body;
    const reservation = await ReservationModel.findOneAndUpdate(
      { _id: id, instanceId },
      updateData,
      { new: true, runValidators: true },
    );
    if (!reservation) {
      return reply.code(404).send({ error: "Réservation non trouvée" });
    }
    return reply.send({ success: true, data: reservation });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur mise à jour réservation");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

/** Mettre à jour le statut d'une réservation */
export async function updateReservationStatus(request, reply) {
  try {
    const { id } = request.params;
    const instanceId = getInstanceId(request);
    const { statut } = request.body;
    const reservation = await ReservationModel.findOneAndUpdate(
      { _id: id, instanceId },
      { statut },
      { new: true, runValidators: true },
    );
    if (!reservation) {
      return reply.code(404).send({ error: "Réservation non trouvée" });
    }
    return reply.send({ success: true, data: reservation });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur mise à jour statut réservation");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

/** Supprimer une réservation */
export async function deleteReservation(request, reply) {
  try {
    const { id } = request.params;
    const instanceId = getInstanceId(request);
    const reservation = await ReservationModel.findOneAndDelete({ _id: id, instanceId });
    if (!reservation) {
      return reply.code(404).send({ error: "Réservation non trouvée" });
    }
    return reply.send({
      success: true,
      message: "Réservation supprimée avec succès",
    });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur suppression réservation");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

/** Vérifier la disponibilité d'un créneau (réservations) */
export async function checkAvailability(request, reply) {
  try {
    const { date, heure, duree } = request.query;
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const conflicts = await ReservationModel.find({
      date: { $gte: startDate, $lt: endDate },
      heure,
      statut: { $nin: ["annule", "termine"] },
    });

    return reply.send({
      success: true,
      available: conflicts.length === 0,
      conflicts: conflicts.length,
    });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur vérification disponibilité réservation");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

/** Créneaux disponibles pour une date (réservations + horaires) */
export async function getAvailableSlots(request, reply) {
  try {
    const instanceId = getInstanceId(request);
    const { date } = request.query;
    const PricingModel = (await import("../models/pricing.js")).default;
    const pricing = await PricingModel.findOne({ instanceId });

    if (!pricing || !pricing.restaurantInfo?.horairesOuverture) {
      return reply.code(503).send({
        error: "Horaires non configurés",
        message:
          "Veuillez configurer les horaires d'ouverture dans la page Configuration",
      });
    }

    const requestDate = new Date(date);
    const joursFr = [
      "dimanche",
      "lundi",
      "mardi",
      "mercredi",
      "jeudi",
      "vendredi",
      "samedi",
    ];
    const jour = joursFr[requestDate.getDay()];
    const horaire = pricing.restaurantInfo.horairesOuverture[jour];

    if (!horaire || !horaire.ouvert) {
      return reply.send({
        success: true,
        availableSlots: [],
        occupiedSlots: [],
        message: "Restaurant fermé ce jour-là",
      });
    }

    const slots = [];
    if (horaire.midi?.ouverture && horaire.midi?.fermeture) {
      const [midiStartH, midiStartM] = horaire.midi.ouverture
        .split(":")
        .map(Number);
      const [midiEndH, midiEndM] = horaire.midi.fermeture
        .split(":")
        .map(Number);
      let currentMinutes = midiStartH * 60 + midiStartM;
      const midiEndMinutes = midiEndH * 60 + midiEndM;
      while (currentMinutes < midiEndMinutes) {
        const hours = Math.floor(currentMinutes / 60);
        const minutes = currentMinutes % 60;
        slots.push(
          `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
        );
        currentMinutes += 30;
      }
    }
    if (horaire.soir?.ouverture && horaire.soir?.fermeture) {
      const [soirStartH, soirStartM] = horaire.soir.ouverture
        .split(":")
        .map(Number);
      const [soirEndH, soirEndM] = horaire.soir.fermeture
        .split(":")
        .map(Number);
      let currentMinutes = soirStartH * 60 + soirStartM;
      const soirEndMinutes = soirEndH * 60 + soirEndM;
      while (currentMinutes < soirEndMinutes) {
        const hours = Math.floor(currentMinutes / 60);
        const minutes = currentMinutes % 60;
        slots.push(
          `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
        );
        currentMinutes += 30;
      }
    }

    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);
    const occupiedReservations = await ReservationModel.find({
      instanceId,
      date: { $gte: startDate, $lt: endDate },
      statut: { $nin: ["annule", "termine"] },
    });
    const occupiedSlots = occupiedReservations.map((r) => r.heure);
    const availableSlots = slots.filter(
      (slot) => !occupiedSlots.includes(slot),
    );

    const heureMinutes = (h) => {
      const [hh, mm] = (h || "00:00").split(":").map(Number);
      return (hh || 0) * 60 + (mm || 0);
    };
    const inRange = (heureStr, debut, fin) => {
      if (!debut || !fin) return false;
      const m = heureMinutes(heureStr);
      const d = heureMinutes(debut);
      const f = heureMinutes(fin);
      return m >= d && m < f;
    };
    let remainingCoversMidi = null;
    let remainingCoversSoir = null;
    const maxCouverts = pricing?.restaurantInfo?.nombreCouverts;
    if (maxCouverts != null && Number(maxCouverts) > 0 && horaire?.midi && horaire?.soir) {
      const midiDebut = horaire.midi.ouverture;
      const midiFin = horaire.midi.fermeture;
      const soirDebut = horaire.soir.ouverture;
      const soirFin = horaire.soir.fermeture;
      const couvertsMidi = occupiedReservations
        .filter((r) => inRange(r.heure, midiDebut, midiFin))
        .reduce((sum, r) => sum + (Number(r.nombrePersonnes) || 0), 0);
      const couvertsSoir = occupiedReservations
        .filter((r) => inRange(r.heure, soirDebut, soirFin))
        .reduce((sum, r) => sum + (Number(r.nombrePersonnes) || 0), 0);
      remainingCoversMidi = Math.max(0, maxCouverts - couvertsMidi);
      remainingCoversSoir = Math.max(0, maxCouverts - couvertsSoir);
    }

    return reply.send({
      success: true,
      availableSlots,
      occupiedSlots,
      remainingCoversMidi,
      remainingCoversSoir,
    });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur créneaux disponibles réservations");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

/**
 * Crée une réservation depuis l'IA (appel vocal / create_appointment)
 * Payload : name, telephone, date, time, description, nombrePersonnes
 */
export async function createReservationFromAI(request, reply) {
  try {
    const data = request.body;

    const rawPhone = String(data.clientPhone ?? data.telephone ?? "").trim();
    const phoneNormalized = digitsOnly(rawPhone);
    if (phoneNormalized.length < 10) {
      return reply.code(400).send({
        error: "Numéro de téléphone invalide ou manquant.",
      });
    }

    const rawTime = data.time ?? data.heure ?? "";
    const heureNormalized = normalizeTime(rawTime);
    if (!heureNormalized) {
      return reply.code(400).send({
        error: "Heure invalide ou manquante.",
      });
    }

    const rawDate = data.date;
    const reservationDate = rawDate ? new Date(rawDate) : null;
    if (!reservationDate || isNaN(reservationDate.getTime())) {
      return reply.code(400).send({
        error: "Date invalide ou manquante.",
      });
    }

    const nombrePersonnes =
      typeof data.nombrePersonnes === "number"
        ? data.nombrePersonnes
        : parseInt(data.nombrePersonnes, 10) || 1;

    const instanceId = getInstanceId(request);
    const existing = await OrderService.findRecentReservation({
      instanceId,
      telephone: rawPhone,
      date: reservationDate,
      heure: heureNormalized,
    });
    if (existing) {
      return reply.code(200).send({
        success: true,
        data: existing,
        message: "Réservation déjà créée",
      });
    }

    // Vérification capacité (max couverts) : toujours appliquée si maxCouverts configuré
    const PricingModel = (await import("../models/pricing.js")).default;
    const pricing = await PricingModel.findOne({ instanceId });
    const maxCouverts = pricing?.restaurantInfo?.nombreCouverts;
    if (maxCouverts != null && Number(maxCouverts) > 0) {
      const startDate = new Date(reservationDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(reservationDate);
      endDate.setDate(endDate.getDate() + 1);
      const reservationsDuJour = await ReservationModel.find({
        instanceId,
        date: { $gte: startDate, $lt: endDate },
        statut: { $nin: ["annule", "termine"] },
      });

      const heureMinutes = (h) => {
        const [hh, mm] = (h || "00:00").split(":").map(Number);
        return (hh || 0) * 60 + (mm || 0);
      };
      const inRange = (heureStr, debut, fin) => {
        if (!debut || !fin) return false;
        const m = heureMinutes(heureStr);
        const d = heureMinutes(debut);
        const f = heureMinutes(fin);
        return m >= d && m < f;
      };

      const horaire = pricing?.restaurantInfo?.horairesOuverture
        ? pricing.restaurantInfo.horairesOuverture[
            ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"][
              new Date(reservationDate).getDay()
            ]
          ]
        : null;
      let serviceDebut = null;
      let serviceFin = null;
      if (horaire?.midi?.ouverture && horaire?.midi?.fermeture && inRange(heureNormalized, horaire.midi.ouverture, horaire.midi.fermeture)) {
        serviceDebut = horaire.midi.ouverture;
        serviceFin = horaire.midi.fermeture;
      } else if (horaire?.soir?.ouverture && horaire?.soir?.fermeture && inRange(heureNormalized, horaire.soir.ouverture, horaire.soir.fermeture)) {
        serviceDebut = horaire.soir.ouverture;
        serviceFin = horaire.soir.fermeture;
      }

      const couvertsReserves =
        serviceDebut != null && serviceFin != null
          ? reservationsDuJour
              .filter((r) => inRange(r.heure, serviceDebut, serviceFin))
              .reduce((sum, r) => sum + (Number(r.nombrePersonnes) || 0), 0)
          : reservationsDuJour.reduce((sum, r) => sum + (Number(r.nombrePersonnes) || 0), 0);
      const couvertsRestants = maxCouverts - couvertsReserves;
      if (nombrePersonnes > couvertsRestants) {
        return reply.code(400).send({
          error: "Capacité insuffisante.",
          message: `Il ne reste que ${couvertsRestants} place(s) pour ce service. Impossible de réserver pour ${nombrePersonnes} personne(s).`,
          remainingCovers: couvertsRestants,
          requestedCovers: nombrePersonnes,
        });
      }
    }

    const reservationToCreate = {
      instanceId,
      nom: (data.name || "Client").trim() || null,
      telephone: rawPhone.trim(),
      date: reservationDate,
      heure: heureNormalized,
      description: data.description || "",
      nombrePersonnes,
      notes_internes: data.notes_internes || "",
      statut: "confirme",
      createdBy: "system",
    };

    const reservation = await ReservationModel.create(reservationToCreate);

    return reply.code(201).send({
      success: true,
      data: reservation,
      message: "Réservation créée",
    });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur création réservation depuis l'IA");
    return reply.code(500).send({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}
