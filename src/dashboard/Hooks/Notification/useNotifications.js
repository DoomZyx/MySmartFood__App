import { useEffect, useCallback } from 'react';
import notificationService from '../../Services/notificationService';

/**
 * Hook pour intégrer les notifications dans les composants
 * Gère les notifications automatiques pour les nouveaux appels et changements de statut
 */
export function useNotifications() {
  // Paramètres par défaut pour les notifications
  const defaultSettings = {
    emailNotifications: false,
    notificationsSonores: true,
    notificationsDesktop: true,
    notificationsUrgentes: true
  };

  /**
   * Notifie un nouvel appel
   */
  const notifyNewCall = useCallback(async (callData) => {
    try {
      await notificationService.notifyNewCall(callData, defaultSettings);
    } catch (error) {
    }
  }, []);

  /**
   * Notifie un changement de statut
   */
  const notifyStatusChange = useCallback(async (callData, oldStatus, newStatus) => {
    try {
      await notificationService.notifyStatusChange(callData, oldStatus, newStatus, defaultSettings);
    } catch (error) {
    }
  }, []);

  /**
   * Notifie une erreur
   */
  const notifyError = useCallback(async (error, context = '') => {
    try {
      if (defaultSettings.notificationsUrgentes) {
        await notificationService.showDesktopNotification(
          '❌ Erreur',
          `${context}: ${error.message || error}`,
          { urgent: true }
        );
      }
    } catch (err) {
    }
  }, []);

  /**
   * Notifie un succès
   */
  const notifySuccess = useCallback(async (message, context = '') => {
    try {
      if (defaultSettings.notificationsSonores) {
        await notificationService.playNotificationSound('success');
      }

      if (defaultSettings.notificationsDesktop) {
        await notificationService.showDesktopNotification(
          '✅ Succès',
          `${context}: ${message}`,
          { urgent: false }
        );
      }
    } catch (error) {
    }
  }, []);

  /**
   * Initialise le service de notification
   */
  const initializeNotifications = useCallback(async () => {
    try {
      if (defaultSettings.notificationsDesktop || defaultSettings.notificationsSonores) {
        await notificationService.initialize();
      }
    } catch (error) {
    }
  }, []);

  // Initialiser les notifications au montage
  useEffect(() => {
    initializeNotifications();
  }, [initializeNotifications]);

  return {
    notifyNewCall,
    notifyStatusChange,
    notifyError,
    notifySuccess,
    initializeNotifications
  };
} 