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
import { canOpenDashboard } from "../../../services/syncDashboardSession";
import { DASHBOARD_PATH, openDashboard } from "../../../utils/dashboardPath";
import "./LoginModal.scss";

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

  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setError("");
      setIsRegisterMode(false);
    }
  }, [isOpen]);

  const finishAuth = (user) => {
    setAuth(user);
    onClose();
    if (loginIntent?.planId) {
      navigate(`/onboarding?planId=${loginIntent.planId}`, { replace: true });
    } else if (
      canOpenDashboard(user) &&
      (loginIntent?.from?.pathname?.startsWith("/app") ||
        loginIntent?.from?.pathname?.startsWith(DASHBOARD_PATH))
    ) {
      navigate(loginIntent.from.pathname, { replace: true });
    } else if (canOpenDashboard(user)) {
      openDashboard(navigate);
    } else if (loginIntent?.from?.pathname) {
      navigate(loginIntent.from.pathname, { replace: true });
    } else {
      navigate("/mon-espace", { replace: true });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Veuillez saisir votre adresse e-mail.");
      return;
    }
    if (!password) {
      setError(isRegisterMode ? "Veuillez saisir un mot de passe." : "Veuillez saisir votre mot de passe.");
      return;
    }
    if (isRegisterMode) {
      if (password.trim().length < 8) {
        setError("Le mot de passe doit contenir au moins 8 caractères.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Les deux mots de passe ne correspondent pas.");
        return;
      }
    }
    setIsLoading(true);
    try {
      const user = isRegisterMode
        ? await registerApi(email.trim(), password)
        : await loginWithEmailPassword(email.trim(), password);
      finishAuth(user);
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

  if (!isOpen) return null;

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
            Connexion
            <span className="text-gradient"> mySmartFood</span>
          </h2>
          <p className="login-modal-subtitle">
            Connectez-vous avec votre adresse e-mail ou avec Google pour accéder à votre espace.
          </p>
          {isRegisterMode && (
            <p className="login-modal-subtitle login-modal-subtitle--info">
              Après inscription, complétez obligatoirement vos informations personnelles et celles de votre restaurant dans Mon espace afin que les données soient transmises à votre instance.
            </p>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="login-email">Adresse e-mail</label>
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
            <div className="form-group">
              <label htmlFor="login-password">Mot de passe</label>
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
              <div className="form-group">
                <label htmlFor="login-confirm">Confirmer le mot de passe</label>
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
                    onClick={() => { setIsRegisterMode(false); setError(""); }}
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
                    onClick={() => { setIsRegisterMode(true); setError(""); }}
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
            Connexion avec Google
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
