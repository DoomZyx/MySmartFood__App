import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getCurrentUser } from "../services/authService";
import { followSiteAuthPath, isPlatformAdminUser } from "@shared/postSiteAuthPath";
import AuthSuccessModal from "../components/Shared/AuthSuccessModal/AuthSuccessModal";
import "./AuthCallback.scss";

/**
 * Page de retour après OAuth. Le backend a déjà défini le cookie HttpOnly
 * et redirigé ici (sans token dans l'URL). On récupère l'utilisateur via
 * GET /auth/me (cookie envoyé automatiquement avec credentials: 'include').
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const { setAuth, user } = useAuth();
  const [error, setError] = useState(null);
  const [successUser, setSuccessUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const apiUser = await getCurrentUser();
      if (cancelled) return;
      if (apiUser) {
        setAuth(apiUser);
        if (isPlatformAdminUser(apiUser)) {
          followSiteAuthPath(navigate, apiUser);
          return;
        }
        setSuccessUser(apiUser);
      } else {
        setError("Échec de la connexion ou session expirée. Réessayez.");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [setAuth, navigate]);

  const continueAfterSuccess = () => {
    const current = successUser || user;
    if (!current) return;
    followSiteAuthPath(navigate, current);
  };

  if (successUser) {
    return (
      <AuthSuccessModal
        isOpen
        email={successUser.email}
        onContinue={continueAfterSuccess}
      />
    );
  }

  return (
    <div className="auth-callback">
      <div className="auth-callback-card">
        {error ? (
          <>
            <p className="auth-callback-error">{error}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate("/login", { replace: true })}
            >
              Retour à la connexion
            </button>
          </>
        ) : (
          <>
            <div className="spinner" />
            <p>Connexion en cours...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
