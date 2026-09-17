import React, { useEffect } from "react";
import "./PlatformOpsModal.scss";

const PlatformOpsModal = ({ isOpen, onClose, children }) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !children) return null;

  return (
    <div className="platform-ops-modal-overlay" role="presentation">
      <div
        className="platform-ops-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Traitement du dossier"
      >
        <div className="platform-ops-modal-bar">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
        <div className="platform-ops-modal-body">{children}</div>
      </div>
    </div>
  );
};

export default PlatformOpsModal;
