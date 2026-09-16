import { useEffect } from "react";
import notificationService from "../../Services/notificationService.js";

/**
 * Hook pour gérer les notifications système
 * Initialise le service de notification, débloque l'audio au premier geste utilisateur
 */
export function useSystemNotifications() {
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        await notificationService.initialize();
      } catch (error) {
        // Ignorer
      }
    };

    initializeNotifications();

    const unlockOnUserGesture = () => {
      notificationService.unlockAudio();
      document.removeEventListener("click", unlockOnUserGesture);
      document.removeEventListener("keydown", unlockOnUserGesture);
    };
    document.addEventListener("click", unlockOnUserGesture, { once: true });
    document.addEventListener("keydown", unlockOnUserGesture, { once: true });

    return () => {
      document.removeEventListener("click", unlockOnUserGesture);
      document.removeEventListener("keydown", unlockOnUserGesture);
      notificationService.cleanup();
    };
  }, []);

  return {
    playSound: (type) => notificationService.playNotificationSound(type),
    showNotification: (title, message, options) =>
      notificationService.showDesktopNotification(title, message, options),
  };
} 