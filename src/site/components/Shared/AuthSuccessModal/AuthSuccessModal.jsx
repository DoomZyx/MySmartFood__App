import { useEffect, useRef } from "react";
import "./AuthSuccessModal.scss";

const AUTO_CONTINUE_MS = 2500;

export default function AuthSuccessModal({
  isOpen,
  email,
  title = "Connexion réussie",
  onContinue,
}) {
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(() => {
      onContinueRef.current?.();
    }, AUTO_CONTINUE_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="auth-success-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-success-title">
      <div className="auth-success-modal">
        <h2 id="auth-success-title" className="auth-success-title">
          {title}
        </h2>
        <p className="auth-success-text">
          {email
            ? `Vous êtes connecté avec ${email}.`
            : "Vous êtes maintenant connecté."}
        </p>
        <button type="button" className="btn btn-primary" onClick={onContinue}>
          Continuer
        </button>
      </div>
    </div>
  );
}
