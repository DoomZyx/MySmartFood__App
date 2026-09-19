// Services/notificationService.js
import { callLogger } from "./logging/logger.js";
import { notifDebugLog } from "./logging/notifDebugLog.js";
import { withTenant } from "../database/transaction.js";
import * as DashboardNotification from "../models/pg/DashboardNotification.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class NotificationService {
  constructor() {
    this.connections = new Set();
  }

  // Ajouter une connexion WebSocket
  addConnection(connection, { tenantIds = [], userId } = {}) {
    connection.tenantIds = Array.isArray(tenantIds) ? tenantIds.filter((id) => UUID_PATTERN.test(id)) : [];
    connection.userId = userId || null;
    this.connections.add(connection);
    notifDebugLog("Connexion ajoutee total=" + this.connections.size);
    callLogger.info(null, "Nouvelle connexion notification ajoutée", {
      totalConnections: this.connections.size,
      connectionId: connection.id || "unknown",
      tenantCount: connection.tenantIds.length,
    });
  }

  // Supprimer une connexion WebSocket
  removeConnection(connection) {
    this.connections.delete(connection);
    notifDebugLog("Connexion supprimee total=" + this.connections.size);
    callLogger.info(null, "Connexion notification supprimée", {
      totalConnections: this.connections.size,
    });
  }

  /**
   * Retourne l'objet socket utilisable pour .send() et .readyState.
   * Le service attend un objet avec .send() et .readyState (ex. WebSocket @fastify/websocket).
   */
  _getSocket(connection) {
    if (connection && typeof connection.send === "function") return connection;
    return connection?.socket ?? connection;
  }

  _isConnectionOpen(connection) {
    const socket = this._getSocket(connection);
    return socket?.readyState === 1;
  }

  _connectionAcceptsTenant(connection, tenantId) {
    if (!tenantId) return true;
    const ids = Array.isArray(connection?.tenantIds) ? connection.tenantIds : [];
    return ids.includes(tenantId);
  }

  async _persist(type, data, tenantId) {
    if (!UUID_PATTERN.test(String(tenantId || ""))) return null;
    try {
      return await withTenant(tenantId, (client) =>
        DashboardNotification.insert(client, tenantId, {
          notificationType: type,
          payload: data || {},
        })
      );
    } catch (error) {
      callLogger.error(null, error, {
        source: "notificationService.js",
        context: "persist_notification",
        type,
        tenantId,
      });
      return null;
    }
  }

  // Envoyer une notification aux dashboards du tenant. Persistée même sans WebSocket.
  sendNotification(type, data, tenantId) {
    notifDebugLog("sendNotification appele type=" + type + " connexions=" + this.connections.size);
    const persistPromise = this._persist(type, data, tenantId);

    const broadcast = (row) => {
      this.cleanupConnections();
      const payloadData = {
        ...(data && typeof data === "object" ? data : {}),
        id: row?.id || data?.id || null,
      };
      const notification = {
        type: "notification",
        notificationType: type,
        data: payloadData,
        timestamp: row?.createdAt || new Date().toISOString(),
      };
      const payload = JSON.stringify(notification);
      let sentCount = 0;
      let idx = 0;
      this.connections.forEach((connection) => {
        if (!this._connectionAcceptsTenant(connection, tenantId)) {
          idx++;
          return;
        }
        const socket = this._getSocket(connection);
        const state = socket?.readyState;
        const hasSend = typeof socket?.send === "function";
        if (state === 1 && hasSend) {
          try {
            socket.send(payload);
            sentCount++;
          } catch (error) {
            callLogger.error(null, error, {
              source: "notificationService.js",
              context: "sendNotification_websocket",
              connectionIndex: idx,
            });
          }
        } else {
          notifDebugLog("Connexion ignoree idx=" + idx + " readyState=" + state + " hasSend=" + hasSend);
          callLogger.info(null, "Connexion ignoree (pas prête pour envoi)", {
            connectionIndex: idx,
            readyState: state,
            hasSend,
          });
        }
        idx++;
      });

      notifDebugLog("Notification envoyee sentCount=" + sentCount + " totalConnections=" + this.connections.size);
      callLogger.info(null, "Notification envoyée", {
        type,
        sentCount,
        totalConnections: this.connections.size,
        persisted: Boolean(row?.id),
        notificationData: payloadData,
      });
      if (sentCount === 0 && this.connections.size > 0) {
        callLogger.warn(null, "Notification envoyée a 0 client (connexions peut-etre fermees)", {
          type,
          totalConnections: this.connections.size,
        });
      } else if (this.connections.size === 0) {
        callLogger.warn(null, "Aucun client WebSocket connecte pour les notifications", { type });
      }
      return sentCount;
    };

    return persistPromise.then(broadcast).catch((error) => {
      callLogger.error(null, error, {
        source: "notificationService.js",
        context: "sendNotification",
        type,
      });
      return broadcast(null);
    });
  }

  /**
   * Retourne un libellé court du type d'appel (résa, commande, modif, annulation, ajout couverts, etc.)
   */
  static getCallTypeLabel(extractedData) {
    const type = (extractedData.type_demande || "").trim();
    const desc = (extractedData.description || "").toLowerCase();
    const services = (extractedData.services || "").toLowerCase();
    const combined = `${type} ${desc} ${services}`.toLowerCase();

    if (type === "Réservation de table") return "Réservation";
    if (type === "Commande à emporter") return "Commande à emporter";
    if (/annul|annulation|cancel/.test(combined)) return "Annulation";
    if (/modif|modification|changement/.test(combined)) return "Modification";
    if (/couverts|convives|personnes|places/.test(combined) && /ajout|plus|suppl/.test(combined)) return "Ajout de couverts";
    if (type) return type;
    return "Appel";
  }

  /**
   * Notification envoyée à chaque fin d'appel IA (transcription traitée), avec libellé du type (résa, commande, etc.).
   * @param {Object} extractedData - Données extraites (nom, telephone, type_demande, description, ...)
   * @param {Object} options - { orderId?, appointmentType?: 'reservation'|'order', createdReservation?, createdOrder? }
   */
  notifyCallEnded(extractedData, options = {}) {
    const label = NotificationService.getCallTypeLabel(extractedData);
    const createdId = options.orderId != null ? String(options.orderId).trim() : "";
    const hasCreated = createdId !== "";
    const appointmentType = options.appointmentType || null;
    const isReservation = appointmentType === "reservation";
    const nom = extractedData.nom || "Client";
    const now = new Date();
    const heureStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    const title = hasCreated
      ? `Appel IA : ${label} enregistré(e)`
      : `Appel IA : ${label}`;
    const message = hasCreated
      ? `${label} pour ${nom} – réservation ou commande créée.`
      : `Appel terminé – ${label} (aucune action enregistrée).`;

    const notificationData = {
      title,
      message,
      hasOrder: hasCreated,
      details: {
        callId: extractedData.callId || null,
        orderId: hasCreated && !isReservation ? createdId : null,
        reservationId: hasCreated && isReservation ? createdId : null,
        appointmentType,
        client: nom,
        telephone: extractedData.telephone || "Non spécifié",
        type_demande: extractedData.type_demande || "Non spécifié",
        callTypeLabel: label,
        services: extractedData.services || "",
        description: extractedData.description || "",
        duration: extractedData.duration || null,
        heure: heureStr,
      },
      priority: hasCreated ? "success" : "info",
    };

    return this.sendNotification(
      "call_completed",
      notificationData,
      options.tenantId || options.instanceId
    );
  }

  /** @deprecated Utiliser notifyCallEnded. Conservé pour compatibilité (ex. route test). */
  notifyCallCompleted(callData) {
    const hasOrder = callData.orderId != null && String(callData.orderId).trim() !== "";
    const label = (callData.callTypeLabel != null && callData.callTypeLabel !== "")
      ? callData.callTypeLabel
      : NotificationService.getCallTypeLabel(callData);
    const notificationData = {
      title: `Appel IA : ${label}${hasOrder ? " enregistré(e)" : ""}`,
      message: hasOrder
        ? `${label} pour ${callData.nom || "Client"} – réservation ou commande créée.`
        : `Appel terminé – ${label} (aucune action enregistrée).`,
      hasOrder,
      details: {
        callId: callData.callId,
        orderId: callData.orderId,
        client: callData.nom || "Client inconnu",
        telephone: callData.telephone || "Non spécifié",
        type_demande: callData.type_demande || "Non spécifié",
        callTypeLabel: label,
        services: callData.services || "Non spécifié",
        description: callData.description || "Aucune description",
        duration: callData.duration || "N/A",
      },
      priority: hasOrder ? "success" : "info",
    };

    return this.sendNotification(
      "call_completed",
      notificationData,
      callData.tenantId || callData.instanceId
    );
  }

  notifyMissedCall({ tenantId, caller, transferred } = {}) {
    const who = caller || "Numéro inconnu";
    const notificationData = {
      title: transferred ? "Appel transféré (ligne coupée)" : "Appel manqué (ligne coupée)",
      message: transferred
        ? `Appel de ${who} transféré vers le restaurant.`
        : `Appel de ${who} rejeté : la ligne IA était coupée.`,
      details: {
        caller: who,
        telephone: who,
        transferred: Boolean(transferred),
      },
      priority: "warning",
    };
    return this.sendNotification("call_missed", notificationData, tenantId);
  }

  // Notification d'erreur d'appel
  notifyCallError(error, callData = {}) {
    const notificationData = {
      title: "Erreur appel IA",
      message: "Erreur lors du traitement de l'appel",
      details: {
        error: error.message || "Erreur inconnue",
        client: callData.nom || "Client inconnu",
        telephone: callData.telephone || "Non spécifié",
        timestamp: new Date().toISOString(),
      },
      priority: "error",
    };

    return this.sendNotification(
      "call_error",
      notificationData,
      callData.tenantId || callData.instanceId
    );
  }

  // Notification de nouveau client
  notifyNewClient(clientData) {
    const notificationData = {
      title: "Nouveau client",
      message: `Nouveau client ajouté : ${clientData.nom}`,
      details: {
        nom: clientData.nom,
        telephone: clientData.telephone,
        timestamp: new Date().toISOString(),
      },
      priority: "info",
    };

    return this.sendNotification(
      "new_client",
      notificationData,
      clientData.tenantId || clientData.instanceId
    );
  }

  // Notification de statut mis à jour
  notifyStatusUpdate(callData) {
    const notificationData = {
      title: "🔄 Statut mis à jour",
      message: `Statut mis à jour pour ${callData.client?.nom || "Client"}`,
      details: {
        client: callData.client?.nom || "Client inconnu",
        oldStatus: callData.oldStatus,
        newStatus: callData.statut,
        timestamp: new Date().toISOString(),
      },
      priority: "info",
    };

    return this.sendNotification(
      "status_update",
      notificationData,
      callData.tenantId || callData.instanceId
    );
  }

  // Notification d'appel en cours (quand quelqu'un téléphone)
  notifyCallInProgress(callData) {
    const notificationData = {
      title: "Appel en cours",
      message: `Appel entrant de ${callData.caller || "Numéro inconnu"}`,
      details: {
        caller: callData.caller,
        timestamp: callData.timestamp || new Date().toISOString(),
        duration: callData.duration || "En cours...",
      },
      priority: "high",
    };

    return this.sendNotification(
      "call_in_progress",
      notificationData,
      callData.tenantId || callData.instanceId
    );
  }

  /**
   * Nettoyer les connexions fermées avant chaque envoi (evite references obsoletes, multi-onglets).
   * Ne pas modifier le Set pendant l'iteration.
   */
  cleanupConnections() {
    const toRemove = [];
    this.connections.forEach((connection) => {
      if (!this._isConnectionOpen(connection)) {
        toRemove.push(connection);
      }
    });
    toRemove.forEach((c) => this.connections.delete(c));
    if (toRemove.length > 0) {
      callLogger.info(null, "Connexions notification nettoyées", {
        removedCount: toRemove.length,
        remainingCount: this.connections.size,
      });
    }
  }
}

// Instance singleton
const notificationService = new NotificationService();

export default notificationService;
