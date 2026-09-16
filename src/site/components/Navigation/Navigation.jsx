import React from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useDemoModal } from "../../contexts/DemoModalContext";
import { useLoginModal } from "../../contexts/LoginModalContext";
import { useAuth } from "../../hooks/useAuth";
import { dashboardHomeHref } from "../../utils/dashboardPath";
import "./Navigation.scss";

const navItems = [
  { name: "Accueil", path: "/" },
  { name: "Nos Services", path: "/services" },
  { name: "Tarifs", path: "/pricing" },
  { name: "Contact", path: "/contact" },
];

const Navigation = () => {
  const location = useLocation();

  return (
    <nav className="navigation">
      <div className="nav-desktop">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={`nav-link ${location.pathname === item.path ? "active" : ""}`}
          >
            {item.name}
          </Link>
        ))}
      </div>
    </nav>
  );
};

export function MobileNavButton({ isOpen, onToggle, buttonRef }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className="mobile-menu-button"
      onClick={onToggle}
      aria-label="Menu de navigation"
      aria-expanded={isOpen}
    >
      {isOpen ? <X size={24} /> : <Menu size={24} />}
    </button>
  );
}

export function MobileNavMenu({ isOpen, onClose, menuRef }) {
  const location = useLocation();
  const { openDemoModal } = useDemoModal();
  const { openLoginModal } = useLoginModal();
  const { isAuthenticated, logout, user } = useAuth();

  if (!isOpen) return null;

  return createPortal(
    <div ref={menuRef} className="mobile-menu-overlay">
      <div className="mobile-menu-content">
        <div className="mobile-nav-links">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`mobile-nav-link ${location.pathname === item.path ? "active" : ""}`}
              onClick={onClose}
            >
              {item.name}
            </Link>
          ))}
        </div>
        <div className="mobile-nav-actions">
          {isAuthenticated ? (
            <>
              <Link to="/mon-espace" className="mobile-nav-link" onClick={onClose}>
                Mon espace
              </Link>
              {(user?.isPlatformAdmin || user?.accessUnlocked) && (
                <a href={dashboardHomeHref()} className="mobile-nav-link" onClick={onClose}>
                  Tableau de bord
                </a>
              )}
              <button
                type="button"
                className="mobile-nav-link mobile-nav-link--button"
                onClick={() => {
                  onClose();
                  logout();
                }}
              >
                Déconnexion
              </button>
            </>
          ) : (
            <button
              type="button"
              className="mobile-nav-link mobile-nav-link--button"
              onClick={() => {
                onClose();
                openLoginModal();
              }}
            >
              Se connecter
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary mobile-nav-demo"
            onClick={() => {
              onClose();
              openDemoModal();
            }}
          >
            Demander une démo
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default Navigation;
