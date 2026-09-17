import React, { useEffect } from "react";
import { X } from "lucide-react";
import "./OnboardingNoticeModal.scss";

const OnboardingNoticeModal = ({
  isOpen,
  title,
  children,
  confirmLabel = "Continuer",
  cancelLabel = "Annuler",
  onConfirm,
  onCancel,
  busy = false,
  hideCancel = false,
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) onCancel?.();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [isOpen, busy, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="onboarding-notice-overlay"
      onClick={() => {
        if (!busy) onCancel?.();
      }}
    >
      <div
        className="onboarding-notice-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-notice-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="onboarding-notice-close"
          onClick={onCancel}
          disabled={busy}
          aria-label="Fermer"
        >
          <X size={22} />
        </button>
        <h2 id="onboarding-notice-title" className="onboarding-notice-title">
          {title}
        </h2>
        <div className="onboarding-notice-body">{children}</div>
        <div className="onboarding-notice-actions">
          {!hideCancel && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={busy}
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Patientez..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingNoticeModal;
