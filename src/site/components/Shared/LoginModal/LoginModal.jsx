import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useLoginModal } from "../../../contexts/LoginModalContext";
import { useAuth } from "../../../hooks/useAuth";
import {
  loginWithEmailPassword,
  registerApi,
  loginWithGoogle,
} from "../../../services/authService";
import { followSiteAuthPath } from "@shared/postSiteAuthPath";
import AuthSuccessModal from "../AuthSuccessModal/AuthSuccessModal";
import "./LoginModal.scss";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function registerFieldIssues({ email, password, confirmPassword }) {
  const items = [];
  const mail = email.trim();
  if (!mail) {
    items.push({ key: "email", label: "Adresse e-mail", status: "missing", reason: "Manquant" });
  } else if (!EMAIL_RE.test(mail)) {
    items.push({
      key: "email",
      label: "Adresse e-mail",
      status: "mismatch",
      reason: "Adresse e-mail invalide",
    });
  }
  if (!password) {
    items.push({ key: "password", label: "Mot de passe", status: "missing", reason: "Manquant" });
  } else if (password.trim().length < 8) {
    items.push({
      key: "password",
      label: "Mot de passe",
      status: "mismatch",
      reason: "Minimum 8 caractères",
    });
  }
  if (!confirmPassword) {
    items.push({
      key: "confirm",
      label: "Confirmation du mot de passe",
      status: "missing",
      reason: "Manquant",
    });
  } else if (password !== confirmPassword) {
    items.push({
      key: "confirm",
      label: "Confirmation du mot de passe",
      status: "mismatch",
      reason: "Ne correspond pas au mot de passe",
    });
  }
  return items;
}

const LoginModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { loginIntent } = useLoginModal();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successUser, setSuccessUser] = useState(null);
  const [registerAttempted, setRegisterAttempted] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setError("");
      setIsRegisterMode(false);
      setSuccessUser(null);
      setRegisterAttempted(false);
      return;
    }
    if (loginIntent?.error === "auth_failed") {
      setError("La connexion Google a échoué. Réessayez depuis cette fenêtre.");
    }
  }, [isOpen, loginIntent]);

  const finishAuth = (user) => {
    setAuth(user);
    onClose();
    followSiteAuthPath(navigate, user, loginIntent);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (isRegisterMode) {
      setRegisterAttempted(true);
      const issues = registerFieldIssues({ email, password, confirmPassword });
      if (issues.length) {
        setError(
          issues
            .map((item) =>
              item.status === "missing"
                ? `${item.label} : manquant`
                : `${item.label} : ${item.reason}`
            )
            .join(" · ")
        );
        return;
      }
    } else {
      if (!email.trim()) {
        setError("Veuillez saisir votre adresse e-mail.");
        return;
      }
      if (!password) {
        setError("Veuillez saisir votre mot de passe.");
        return;
      }
    }
    setIsLoading(true);
    try {
      const user = isRegisterMode
        ? await registerApi(email.trim(), password)
        : await loginWithEmailPassword(email.trim(), password);
      setAuth(user);
      setSuccessUser(user);
    } catch (err) {
      setError(err.message || (isRegisterMode ? "Inscription impossible." : "Connexion impossible."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    try {
      loginWithGoogle();
    } catch (err) {
      setError(err.message || "Connexion Google impossible.");
    }
  };

  const handleClose = useCallback(() => {
    setError("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") handleClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, handleClose]);

  if (successUser) {
    return (
      <AuthSuccessModal
        isOpen
        email={successUser.email}
        title={isRegisterMode ? "Compte créé" : "Connexion réussie"}
        text={
          isRegisterMode
            ? `Compte créé pour ${successUser.email}. Prochaine étape : le dossier restaurant dans Mon espace.`
            : undefined
        }
        onContinue={() => finishAuth(successUser)}
      />
    );
  }

  if (!isOpen) return null;

  const issues = isRegisterMode
    ? registerFieldIssues({ email, password, confirmPassword })
    : [];
  const showIssues = isRegisterMode && registerAttempted;
  const issueOf = (key) => (showIssues ? issues.find((item) => item.key === key) : null);
  const fieldClass = (key) => {
    const issue = issueOf(key);
    if (!issue) return "form-group";
    return issue.status === "missing"
      ? "form-group login-field-missing"
      : "form-group login-field-mismatch";
  };

  return (
    <div className="login-modal-overlay" onClick={handleClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="login-modal-close"
          onClick={handleClose}
          aria-label="Fermer"
        >
          <X size={24} />
        </button>

        <div className="login-modal-content">
          <h2 className="login-modal-title">
            {isRegisterMode ? "Inscription" : "Connexion"}
            <span className="text-gradient"> mySmartFood</span>
          </h2>
          <p className="login-modal-subtitle">
            {isRegisterMode
              ? "Créez votre compte avec e-mail ou Google. Le dossier restaurant se complète ensuite dans Mon espace."
              : "Connectez-vous avec votre adresse e-mail ou avec Google pour accéder à votre espace."}
          </p>
          {showIssues && issues.length > 0 ? (
            <div className="login-issues" aria-label="Champs à corriger">
              {issues.filter((item) => item.status === "missing").length > 0 ? (
                <p>
                  Manquant :{" "}
                  {issues
                    .filter((item) => item.status === "missing")
                    .map((item) => item.label)
                    .join(", ")}
                </p>
              ) : null}
              {issues.filter((item) => item.status === "mismatch").length > 0 ? (
                <p>
                  Ne correspond pas :{" "}
                  {issues
                    .filter((item) => item.status === "mismatch")
                    .map((item) => `${item.label} (${item.reason})`)
                    .join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="login-form">
            <div className={fieldClass("email")}>
              <label htmlFor="login-email">
                Adresse e-mail
                {issueOf("email")?.status === "missing" ? (
                  <em className="login-field-flag">Manquant</em>
                ) : null}
                {issueOf("email")?.status === "mismatch" ? (
                  <em className="login-field-flag">Ne correspond pas</em>
                ) : null}
              </label>
              <input
                type="email"
                id="login-email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="votre@email.com"
                autoComplete="email"
                disabled={isLoading}
              />
            </div>
            <div className={fieldClass("password")}>
              <label htmlFor="login-password">
                Mot de passe
                {issueOf("password")?.status === "missing" ? (
                  <em className="login-field-flag">Manquant</em>
                ) : null}
                {issueOf("password")?.status === "mismatch" ? (
                  <em className="login-field-flag">Ne correspond pas</em>
                ) : null}
              </label>
              <input
                type="password"
                id="login-password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder={isRegisterMode ? "Minimum 8 caractères" : "Mot de passe"}
                autoComplete={isRegisterMode ? "new-password" : "current-password"}
                minLength={isRegisterMode ? 8 : undefined}
                disabled={isLoading}
              />
            </div>
            {isRegisterMode && (
              <div className={fieldClass("confirm")}>
                <label htmlFor="login-confirm">
                  Confirmer le mot de passe
                  {issueOf("confirm")?.status === "missing" ? (
                    <em className="login-field-flag">Manquant</em>
                  ) : null}
                  {issueOf("confirm")?.status === "mismatch" ? (
                    <em className="login-field-flag">Ne correspond pas</em>
                  ) : null}
                </label>
                <input
                  type="password"
                  id="login-confirm"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirmer le mot de passe"
                  autoComplete="new-password"
                  minLength={8}
                  disabled={isLoading}
                />
              </div>
            )}
            {error ? (
              <p className="login-form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              className="btn btn-primary login-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  {isRegisterMode ? "Inscription en cours..." : "Connexion en cours..."}
                </>
              ) : isRegisterMode ? (
                "Créer mon compte"
              ) : (
                "Se connecter"
              )}
            </button>
            <p className="login-modal-toggle">
              {isRegisterMode ? (
                <>
                  Déjà un compte ?{" "}
                  <button
                    type="button"
                    className="login-modal-toggle-btn"
                    onClick={() => {
                      setIsRegisterMode(false);
                      setError("");
                      setRegisterAttempted(false);
                    }}
                  >
                    Se connecter
                  </button>
                </>
              ) : (
                <>
                  Pas encore de compte ?{" "}
                  <button
                    type="button"
                    className="login-modal-toggle-btn"
                    onClick={() => {
                      setIsRegisterMode(true);
                      setError("");
                      setRegisterAttempted(false);
                    }}
                  >
                    Créer un compte
                  </button>
                </>
              )}
            </p>
          </form>

          <div className="login-modal-divider">
            <span>ou</span>
          </div>

          <button
            type="button"
            className="btn btn-secondary login-google-btn"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <GoogleIcon />
            {isRegisterMode ? "Inscription avec Google" : "Connexion avec Google"}
          </button>
        </div>
      </div>
    </div>
  );
};

function GoogleIcon() {
  return (
    <svg className="google-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default LoginModal;
