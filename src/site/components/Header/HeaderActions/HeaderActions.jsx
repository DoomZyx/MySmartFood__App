import React from "react";
import { useDemoModal } from "../../../contexts/DemoModalContext";
import { useLoginModal } from "../../../contexts/LoginModalContext";
import { useAuth } from "../../../hooks/useAuth";
import "./HeaderActions.scss";

const HeaderActions = () => {
  const { openDemoModal } = useDemoModal();
  const { openLoginModal } = useLoginModal();
  const { isAuthenticated } = useAuth();

  return (
    <div className="header-actions">
      {isAuthenticated ? null : (
        <button
          type="button"
          className="btn btn-secondary header-login-btn"
          onClick={() => openLoginModal()}
        >
          <span className="header-login-btn__full">Se connecter</span>
          <span className="header-login-btn__short">Connexion</span>
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
