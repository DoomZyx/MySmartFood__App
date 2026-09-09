import OrderModel from "../../models/order.js";
import ReservationModel from "../../models/reservation.js";

const RECENT_DUPLICATE_WINDOW_MS = 30 * 60 * 1000;

/**
 * Service de gestion des commandes et réservations
 */
export class OrderService {
  static digitsOnly(phone) {
    if (phone == null || phone === "") return "";
    return String(phone).replace(/\D/g, "");
  }

  static dayRange(date) {
    const startDate = new Date(date);
    if (isNaN(startDate.getTime())) return null;
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    return { startDate, endDate };
  }

  /**
   * Evite un doublon systeme (tool live + process-call, ou tool relance).
   */
  static async findRecentReservation({ instanceId, telephone, date, heure }) {
    const phone = this.digitsOnly(telephone);
    const range = this.dayRange(date);
    if (!phone || phone.length < 10 || !heure || !range) return null;
    const since = new Date(Date.now() - RECENT_DUPLICATE_WINDOW_MS);
    const candidates = await ReservationModel.find({
      instanceId: instanceId || "inst_default",
      date: { $gte: range.startDate, $lt: range.endDate },
      heure,
      createdBy: "system",
      statut: { $nin: ["annule"] },
      createdAt: { $gte: since },
    }).sort({ createdAt: -1 }).limit(20);
    return candidates.find((row) => this.digitsOnly(row.telephone) === phone) || null;
  }

  static async findRecentOrder({ instanceId, telephone, date, heure }) {
    const phone = this.digitsOnly(telephone);
    const range = this.dayRange(date);
    if (!phone || phone.length < 10 || !heure || !range) return null;
    const since = new Date(Date.now() - RECENT_DUPLICATE_WINDOW_MS);
    const candidates = await OrderModel.find({
      instanceId: instanceId || "inst_default",
      date: { $gte: range.startDate, $lt: range.endDate },
      heure,
      createdBy: "system",
      statut: { $nin: ["annule"] },
      createdAt: { $gte: since },
    }).sort({ createdAt: -1 }).limit(20);
    return candidates.find((row) => this.digitsOnly(row.telephone) === phone) || null;
  }

  /**
   * Crée une réservation depuis les données extraites (structure modèle Reservation)
   * @param {Object} reservationData - Données réservation (nom, telephone, date, heure, description, nombrePersonnes, etc.)
   * @param {Object} options - Options (callId)
   * @returns {Promise<Object|null>} Réservation créée ou null
   */
  static async createReservationFromData(reservationData, options = {}) {
    const { callId, instanceId } = options;
    const id = instanceId || "inst_default";
    const { orderDate, orderHeure } = this._handleAsapDateTime(
      reservationData.date,
      reservationData.heure
    );
    const existing = await this.findRecentReservation({
      instanceId: id,
      telephone: reservationData.telephone,
      date: orderDate,
      heure: orderHeure,
    });
    if (existing) return existing;
    const created = await ReservationModel.create({
      instanceId: id,
      nom: reservationData.nom || "Client inconnu",
      telephone: reservationData.telephone && reservationData.telephone !== "Non fourni" ? reservationData.telephone : null,
      date: orderDate,
      heure: orderHeure,
      description: reservationData.description || "",
      nombrePersonnes: typeof reservationData.nombrePersonnes === "number" ? reservationData.nombrePersonnes : 1,
      notes_internes: reservationData.notes_internes || "",
      statut: reservationData.statut || "confirme",
      createdBy: "system",
      related_call: callId || null,
    });
    return created;
  }

  /**
   * Crée une commande à emporter depuis les données extraites (structure modèle Order)
   * @param {Object} orderData - Données commande (nom, telephone, date, heure, commandes, etc.)
   * @param {Object} options - Options (client, callId, nom, telephone)
   * @returns {Promise<Object|null>} Commande créée ou null
   */
  static async createOrderFromAppointment(orderData, options = {}) {
    const { client, callId, nom, telephone, instanceId } = options;
    const id = instanceId || "inst_default";
    const { orderDate, orderHeure } = this._handleAsapDateTime(
      orderData.date,
      orderData.heure
    );
    const existing = await this.findRecentOrder({
      instanceId: id,
      telephone: telephone || orderData.telephone,
      date: orderDate,
      heure: orderHeure,
    });
    if (existing) return existing;
    const createdOrder = await OrderModel.create({
      instanceId: id,
      nom: !client ? (nom || orderData.nom || "Client Inconnu") : null,
      telephone: !client && (telephone || orderData.telephone) && (telephone || orderData.telephone) !== "Non fourni" ? (telephone || orderData.telephone) : null,
      date: orderDate,
      heure: orderHeure,
      commandes: orderData.commandes || [],
      statut: orderData.statut || "confirme",
      createdBy: "system",
      related_call: callId || null,
    });
    return createdOrder;
  }

  /**
   * Gère les valeurs ASAP pour date/heure
   * @param {string} date - Date de la commande
   * @param {string} heure - Heure de la commande
   * @returns {Object} { orderDate, orderHeure }
   * @private
   */
  static _handleAsapDateTime(date, heure) {
    let orderDate = new Date();
    let orderHeure = heure;

    // Gestion date ASAP
    if (date === "ASAP") {
      orderDate = new Date();
    } else {
      orderDate = new Date(date);
    }

    // Gestion heure ASAP
    if (heure === "ASAP") {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 30); // +30 min de préparation
      orderHeure = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    return { orderDate, orderHeure };
  }

  /**
   * Recherche des commandes par critères
   * @param {Object} criteria - Critères de recherche
   * @returns {Promise<Array>} Commandes trouvées
   */
  static async searchOrders(criteria) {
    const { searchTerm, isDateSearch, clientIds, instanceId } = criteria;
    const id = instanceId || "inst_default";

    let filters = { instanceId: id };

    if (isDateSearch) {
      filters.date = {
        $gte: new Date(searchTerm),
        $lt: new Date(`${searchTerm}T23:59:59Z`)
      };
    } else {
      filters.$or = [
        { client: { $in: clientIds } },
        { type: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { notes_internes: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    const orders = await OrderModel.find(filters)
      .populate('client')
      .sort({ date: -1, heure: -1 })
      .limit(10);

    return orders;
  }

  /**
   * Récupère les commandes d'un client
   * @param {string} clientId - ID du client
   * @returns {Promise<Array>} Commandes du client
   */
  static async getOrdersByClient(clientId, instanceId) {
    const id = instanceId || "inst_default";
    const orders = await OrderModel.find({ instanceId: id, client: clientId })
      .sort({ date: -1, heure: -1 })
      .populate("client");

    return orders;
  }
}

