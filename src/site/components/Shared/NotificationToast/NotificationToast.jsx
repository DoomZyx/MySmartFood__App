import React, { useEffect } from "react";
import { CheckCircle, X } from "lucide-react";
import "./NotificationToast.scss";

/**
 * Toast de notification (succès, info).
 * S'affiche en position fixe et se ferme automatiquement après autoHide ms.
 */
const NotificationToast = ({
  message,
  visible,
  onClose,
  autoHide = 4000,
  type = "success",
}) => {
  useEffect(() => {
    if (!visible || !onClose || autoHide <= 0) return;
    const t = setTimeout(onClose, autoHide);
    return () => clearTimeout(t);
  }, [visible, onClose, autoHide]);

  if (!visible) return null;

  return (
    <div
      className={`notification-toast notification-toast--${type}`}
      role="status"
      aria-live="polite"
    >
      <CheckCircle className="notification-toast__icon" />
      <span className="notification-toast__message">{message}</span>
      <button
        type="button"
        className="notification-toast__close"
        onClick={onClose}
        aria-label="Fermer la notification"
      >
        <X />
      </button>
    </div>
  );
};

export default NotificationToast;
