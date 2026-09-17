import React from "react";
import { Link } from "react-router-dom";
import { useDemoModal } from "../../../contexts/DemoModalContext";
import { useLoginModal } from "../../../contexts/LoginModalContext";
import { useAuth } from "../../../hooks/useAuth";
import { dashboardHomeHref } from "../../../utils/dashboardPath";
import { PLATFORM_ADMIN_PATH } from "../../../utils/platformAdminPath";
import "./HeaderActions.scss";

const HeaderActions = () => {
  const { openDemoModal } = useDemoModal();
  const { openLoginModal } = useLoginModal();
  const { isAuthenticated, logout, user } = useAuth();
  const showDashboard = Boolean(user?.accessUnlocked);

  return (
    <div className={`header-actions${isAuthenticated ? " header-actions--authenticated" : ""}`}>
      {isAuthenticated ? (
        <>
          <Link to="/mon-espace" className="header-text-link">
            Mon espace
          </Link>
          {showDashboard && (
            <a href={dashboardHomeHref()} className="header-text-link">
              Tableau de bord
            </a>
          )}
          {user?.isPlatformAdmin && (
            <Link to={PLATFORM_ADMIN_PATH} className="header-text-link">
              Back-office
            </Link>
          )}
          <button type="button" className="header-text-link header-text-link--button" onClick={logout}>
            Déconnexion
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn btn-secondary header-link-btn"
          onClick={() => openLoginModal()}
        >
          Se connecter
        </button>
      )}
      <button type="button" className="btn btn-primary header-demo-btn" onClick={openDemoModal}>
        <span className="header-demo-btn__full">Demander une démo</span>
        <span className="header-demo-btn__short">Démo</span>
      </button>
    </div>
  );
};

export default HeaderActions;
