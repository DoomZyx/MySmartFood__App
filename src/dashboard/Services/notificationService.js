/**
 * Service de gestion des notifications
 * Gère les notifications email, sonores et desktop
 */
import { getApiKey } from "../API/apiKey.js";

class NotificationService {
  constructor() {
    this.audioContext = null;
    this.notificationSound = null;
    this.isInitialized = false;
    this.notifications = []; // Liste des notifications pour l'UI
    this.listeners = []; // Écouteurs pour les changements de notifications
  }

  /**
   * Initialise le service de notification (permissions uniquement).
   * Ne crée pas l'AudioContext : il sera créé au premier son ou après un geste utilisateur (politique navigateur).
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      if ("Notification" in window) {
        await Notification.requestPermission();
      }
      this.isInitialized = true;
    } catch (error) {
      // Ignorer les erreurs de permission
    }
  }

  /**
   * Crée ou retourne l'AudioContext (création paresseuse).
   */
  _getAudioContext() {
    if (this.audioContext) return this.audioContext;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    this.audioContext = new Ctx();
    return this.audioContext;
  }

  /**
   * Débloque l'audio après un geste utilisateur (clic, touche). À appeler une fois au premier clic.
   */
  async unlockAudio() {
    const ctx = this._getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (e) {
        // Réservation refusée sans geste utilisateur
      }
    }
  }

  /**
   * Connecte le service au WebSocket pour les notifications système
   * @param {WebSocket} wsConnection - Connexion WebSocket
   */
  connectToWebSocket(wsConnection) {
    this.wsConnection = wsConnection;
  }

  /**
   * Ajoute une notification à la liste (pour l'UI)
   * @param {Object} notificationData - Données de la notification
   */
  addNotification(notificationData) {
    const payload = notificationData && typeof notificationData === "object" ? notificationData : {};
    const newNotification = {
      id: Date.now() + Math.random(),
      title: payload.title ?? "Notification",
      message: payload.message ?? "",
      priority: payload.priority ?? "info",
      details: payload.details && typeof payload.details === "object" ? payload.details : {},
      notificationType: payload.notificationType ?? "call_completed",
      timestamp: new Date(),
      read: false,
    };

    this.notifications = [newNotification, ...this.notifications.slice(0, 19)];
    if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
      console.log("[NOTIF] addNotification liste length=" + this.notifications.length + " title=" + (newNotification.title || ""));
    }
    this.notifyListeners();

    return newNotification;
  }

  /**
   * Supprime une notification de la liste
   * @param {string} id - ID de la notification à supprimer
   */
  removeNotification(id) {
    this.notifications = this.notifications.filter(notif => notif.id !== id);
    this.notifyListeners();
  }

  /**
   * Marque une notification comme lue
   * @param {string} id - ID de la notification à marquer comme lue
   */
  markAsRead(id) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.notifyListeners();
    }
  }

  /**
   * Vide toutes les notifications
   */
  clearAllNotifications() {
    this.notifications = [];
    this.notifyListeners();
  }

  /**
   * S'abonner aux changements de notifications
   * @param {Function} listener - Fonction appelée lors des changements
   * @returns {Function} Fonction pour se désabonner
   */
  subscribe(listener) {
    this.listeners.push(listener);
    // Retourner une fonction pour se désabonner
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notifie tous les écouteurs des changements (copie du tableau pour forcer le re-render React)
   */
  notifyListeners() {
    const snapshot = [...this.notifications];
    if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
      console.log("[NOTIF] notifyListeners listeners=" + this.listeners.length + " notifications=" + snapshot.length);
    }
    this.listeners.forEach(listener => listener(snapshot));
  }

  /**
   * Déclenche une notification système basée sur les données WebSocket
   * @param {Object} notificationData - Données de notification du WebSocket
   */
  async triggerSystemNotification(notificationData) {
    if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
      console.log("[NOTIF] triggerSystemNotification appele", notificationData?.title || notificationData?.notificationType || "?");
    }
    if (!notificationData || typeof notificationData !== "object") {
      if (typeof import.meta !== "undefined" && import.meta.env?.DEV) console.warn("[NOTIF] triggerSystemNotification ignore (donnees invalides)");
      return;
    }

    const title = notificationData.title ?? notificationData.details?.callTypeLabel ?? "Appel IA";
    const message = notificationData.message ?? notificationData.details?.type_demande ?? "Nouvelle notification";
    const payload = {
      ...notificationData,
      title,
      message,
    };
    this.addNotification(payload);

    if (!this.isInitialized) {
      await this.initialize();
    }

    const priority = notificationData.priority ?? "info";
    const details = notificationData.details && typeof notificationData.details === "object" ? notificationData.details : {};

    try {
      const soundType =
        priority === "error"
          ? "urgent"
          : priority === "success"
          ? "success"
          : "normal";
      await this.playNotificationSound(soundType);
    } catch (e) {
      // Ignorer les erreurs son (politique navigateur, etc.)
    }

    try {
      await this.showDesktopNotification(title || "Notification", message || "", {
        urgent: priority === "error",
        body: message,
        data: details,
      });
    } catch (e) {
      // Ignorer les erreurs desktop (permission refusée, etc.)
    }
  }

  /**
   * Joue un son de notification. L'AudioContext est créé/repris à la volée ;
   * si le navigateur le garde en "suspended" (pas de geste utilisateur), le son est ignoré.
   * @param {string} type - Type de son ('urgent', 'normal', 'success')
   */
  async playNotificationSound(type = "normal") {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const ctx = this._getAudioContext();
    if (!ctx) return;

    try {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      if (ctx.state !== "running") {
        return;
      }
    } catch (e) {
      return;
    }

    try {
      const frequencies = {
        urgent: [800, 600, 800, 600, 800],
        normal: [440, 660],
        success: [523, 659, 784],
      };

      const freq = frequencies[type] || frequencies.normal;

      for (let i = 0; i < freq.length; i++) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.setValueAtTime(freq[i], ctx.currentTime);
        oscillator.type = "sine";

        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

        oscillator.start(ctx.currentTime + i * 0.2);
        oscillator.stop(ctx.currentTime + i * 0.2 + 0.3);
      }
    } catch (error) {
      // Ignorer si le contexte a été fermé ou refusé
    }
  }

  /**
   * Affiche une notification desktop
   * @param {string} title - Titre de la notification
   * @param {string} message - Message de la notification
   * @param {Object} options - Options de la notification
   */
  async showDesktopNotification(title, message, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if ("Notification" in window && Notification.permission === "granted") {
        const notification = new Notification(title, {
          icon: "/vite.svg",
          badge: "/vite.svg",
          tag: "handlehome-notification",
          requireInteraction: options.urgent || false,
          ...options,
        });

        // Gérer les clics sur la notification
        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        // Auto-fermeture après 5 secondes (sauf si urgent)
        if (!options.urgent) {
          setTimeout(() => notification.close(), 5000);
        }

        return notification;
      }
    } catch (error) {
    }
  }

  /**
   * Envoie une notification email (simulation)
   * @param {string} to - Destinataire
   * @param {string} subject - Sujet
   * @param {string} message - Message
   */
  async sendEmailNotification(to, subject, message) {
    try {
      // Simulation d'envoi d'email

      // Ici vous pourriez appeler votre API backend pour envoyer l'email
      const response = await fetch("/api/notifications/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": getApiKey(),
        },
        body: JSON.stringify({ to, subject, message }),
      });

      if (!response.ok) {
        throw new Error("Erreur envoi email");
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Notifie un nouvel appel
   * @param {Object} callData - Données de l'appel
   * @param {Object} settings - Paramètres de notification
   */
  async notifyNewCall(callData, settings) {
    const { nom, telephone, type_demande, statut } = callData;

    try {
      // Notification sonore si activée
      if (settings.notificationsSonores) {
        const soundType = statut === "urgent" ? "urgent" : "normal";
        await this.playNotificationSound(soundType);
      }

      // Notification desktop si activée
      if (settings.notificationsDesktop) {
        const title = `📞 Nouvel appel - ${nom}`;
        const message = `${type_demande} - ${telephone}`;

        await this.showDesktopNotification(title, message, {
          urgent: settings.notificationsUrgentes,
          data: callData,
        });
      }

      // Notification email si activée
      if (settings.emailNotifications) {
        const subject = `Nouvel appel reçu - ${nom}`;
        const message = `
          Nouvel appel reçu :
          - Nom: ${nom}
          - Téléphone: ${telephone}
          - Type: ${type_demande}
          - Statut: ${statut}
        `;

        await this.sendEmailNotification(
          "admin@handlehome.com",
          subject,
          message
        );
      }

    } catch (error) {
    }
  }

  /**
   * Notifie un changement de statut
   * @param {Object} callData - Données de l'appel
   * @param {string} oldStatus - Ancien statut
   * @param {string} newStatus - Nouveau statut
   * @param {Object} settings - Paramètres de notification
   */
  async notifyStatusChange(callData, oldStatus, newStatus, settings) {
    const { nom, type_demande } = callData;

    try {
      // Notification sonore si activée
      if (settings.notificationsSonores) {
        await this.playNotificationSound("success");
      }

      // Notification desktop si activée
      if (settings.notificationsDesktop) {
        const title = `🔄 Statut mis à jour - ${nom}`;
        const message = `${type_demande}: ${oldStatus} → ${newStatus}`;

        await this.showDesktopNotification(title, message, {
          urgent: false,
          data: { callData, oldStatus, newStatus },
        });
      }

    } catch (error) {
    }
  }

  /**
   * Nettoie les ressources
   */
  cleanup() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isInitialized = false;
  }
}

// Instance singleton
const notificationService = new NotificationService();

export default notificationService;
