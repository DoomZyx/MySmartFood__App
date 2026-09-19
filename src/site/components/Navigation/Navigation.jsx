import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  CreditCard,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  Menu,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useDemoModal } from "../../contexts/DemoModalContext";
import { useLoginModal } from "../../contexts/LoginModalContext";
import { useAuth } from "../../hooks/useAuth";
import { canOpenDashboard } from "@shared/syncDashboardSession";
import { dashboardHomeHref } from "../../utils/dashboardPath";
import { getAccountStatus } from "../../utils/accountStatus";
import "./Navigation.scss";

export const SITE_NAV_ITEMS = [
  { name: "Accueil", shortName: "Accueil", path: "/" },
  { name: "Nos Services", shortName: "Services", path: "/services" },
  { name: "Tarifs", shortName: "Tarifs", path: "/pricing" },
  { name: "Contact", shortName: "Contact", path: "/contact" },
];

const menuIcons = {
  "/": Home,
  "/services": Sparkles,
  "/pricing": CreditCard,
  "/contact": Mail,
};

export function DesktopNav() {
  const location = useLocation();

  return (
    <nav className="nav-desktop" aria-label="Navigation principale">
      {SITE_NAV_ITEMS.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`nav-link${location.pathname === item.path ? " is-active" : ""}`}
        >
          <span className="nav-link__full">{item.name}</span>
          <span className="nav-link__short">{item.shortName}</span>
        </Link>
      ))}
    </nav>
  );
}

export function SiteMenuButton({ isOpen, onToggle, buttonRef }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      id="site-menu-button"
      className={`site-menu-button${isOpen ? " is-open" : ""}`}
      onClick={onToggle}
      aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
      aria-expanded={isOpen}
      aria-controls="site-menu-panel"
    >
      {isOpen ? <X size={20} /> : <Menu size={20} />}
      <span className="site-menu-button__label">Menu</span>
    </button>
  );
}

export function SiteMenuPanel({ isOpen, onClose }) {
  const location = useLocation();
  const { openDemoModal } = useDemoModal();
  const { openLoginModal } = useLoginModal();
  const { isAuthenticated, logout, user } = useAuth();
  const showDashboard = canOpenDashboard(user);
  const status = getAccountStatus(isAuthenticated ? user : null);

  if (!isOpen) return null;

  return (
    <div
      id="site-menu-panel"
      className="site-menu-panel"
      role="menu"
      aria-label="Menu du compte"
    >
      <div className="site-menu-panel__links">
        {SITE_NAV_ITEMS.map((item) => {
          const Icon = menuIcons[item.path];
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              role="menuitem"
              className={`site-menu-link${isActive ? " is-active" : ""}`}
              onClick={onClose}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      <div className="site-menu-panel__account">
        <div className="site-menu-status">
          <span className="site-menu-status__label">Statut</span>
          <span className="site-menu-status__value">{status.label}</span>
        </div>
        {isAuthenticated ? (
          <>
            <Link to="/mon-espace" role="menuitem" className="site-menu-link" onClick={onClose}>
              <UserRound size={18} aria-hidden="true" />
              <span>Mon espace</span>
            </Link>
            {showDashboard && (
              <a href={dashboardHomeHref()} role="menuitem" className="site-menu-link" onClick={onClose}>
                <LayoutDashboard size={18} aria-hidden="true" />
                <span>Tableau de bord</span>
              </a>
            )}
            <button
              type="button"
              role="menuitem"
              className="site-menu-link site-menu-link--button"
              onClick={() => {
                onClose();
                logout();
              }}
            >
              <LogOut size={18} aria-hidden="true" />
              <span>Déconnexion</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            role="menuitem"
            className="site-menu-link site-menu-link--button"
            onClick={() => {
              onClose();
              openLoginModal();
            }}
          >
            <LogIn size={18} aria-hidden="true" />
            <span>Se connecter</span>
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary site-menu-demo"
          onClick={() => {
            onClose();
            openDemoModal();
          }}
        >
          Demander une démo
        </button>
      </div>
    </div>
  );
}
