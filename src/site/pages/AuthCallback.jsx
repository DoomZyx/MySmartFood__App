import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getCurrentUser } from "../services/authService";
import { canOpenDashboard } from "../services/syncDashboardSession";
import { openDashboard } from "../utils/dashboardPath";
import "./AuthCallback.scss";

/**
 * Page de retour après OAuth. Le backend a déjà défini le cookie HttpOnly
 * et redirigé ici (sans token dans l'URL). On récupère l'utilisateur via
 * GET /auth/me (cookie envoyé automatiquement avec credentials: 'include').
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated, user } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const apiUser = await getCurrentUser();
      if (cancelled) return;
      if (apiUser) {
        setAuth(apiUser);
        if (canOpenDashboard(apiUser)) {
          openDashboard(navigate);
        } else {
          navigate(apiUser.planId || apiUser.smartcrmInstanceId ? "/mon-espace" : "/onboarding", {
            replace: true,
          });
        }
      } else {
        setError("Échec de la connexion ou session expirée. Réessayez.");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [setAuth, navigate]);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (canOpenDashboard(user)) {
        openDashboard(navigate);
      } else {
        navigate(user.planId || user.smartcrmInstanceId ? "/mon-espace" : "/onboarding", {
          replace: true,
        });
      }
    }
  }, [isAuthenticated, user, navigate]);

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
