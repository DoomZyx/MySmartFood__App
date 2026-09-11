import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getCurrentUser, logoutUser, isAdmin } from "../../API/auth";
import PhoneToggle from "../PhoneToggle/PhoneToggle";
import "./menu.scss";

import leon from "../../assets/leon.png";

function Menu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    const onEscape = (e) => {
      if (e.key === "Escape") closeMenu();
    };
    if (isMenuOpen) {
      window.addEventListener("keydown", onEscape);
      return () => window.removeEventListener("keydown", onEscape);
    }
  }, [isMenuOpen]);

  const handleLogout = () => {
    logoutUser();
    navigate("/", { replace: true });
  };

  // Construire l'URL de l'avatar (Cloudinary renvoie des URLs complètes)
  const avatarUrl = currentUser?.avatar
    ? currentUser.avatar.startsWith("http")
      ? currentUser.avatar
      : `${import.meta.env.VITE_API_URL}${currentUser.avatar}`
    : leon;

  return (
    <>
      <button
        type="button"
        className="menu-burger"
        onClick={() => setIsMenuOpen((prev) => !prev)}
        aria-label={isMenuOpen ? t("menu.closeMenu") : t("menu.openMenu")}
        aria-expanded={isMenuOpen}
      >
        <i className={isMenuOpen ? "bi bi-x-lg" : "bi bi-list"} />
      </button>
      {isMenuOpen && (
        <div
          className="nav-overlay"
          onClick={closeMenu}
          role="button"
          tabIndex={0}
          aria-label={t("menu.closeMenu")}
        />
      )}
      <nav className={isMenuOpen ? "open" : ""}>
        <button
          type="button"
          className="nav-close"
          onClick={closeMenu}
          aria-label={t("menu.closeMenu")}
        >
          <i className="bi bi-x-lg" />
        </button>
        <div className="profile">
          <div className="profile-container">
            <img src={avatarUrl} alt="Avatar" />
            <h2>{currentUser?.username || t("menu.user")}</h2>
            <span className="user-role">
              {isAdmin() ? t("menu.admin") : t("menu.user")}
            </span>
          </div>
          <Link to="/app" className="dashboard-link" onClick={closeMenu}>
            <i className="bi bi-speedometer2"></i>
            <span>{t("menu.dashboard")}</span>
          </Link>
        </div>

        <div className="handleCall-container">
          <div className="call-features-list">
            <Link to="/orders" onClick={closeMenu}>
              <i className="bi bi-bag-check"></i> <h3>{t("menu.orders")}</h3>
            </Link>
            <Link to="/reservations" onClick={closeMenu}>
              <i className="bi bi-calendar-check"></i>{" "}
              <h3>{t("menu.reservations")}</h3>
            </Link>
            <Link to="/configuration" onClick={closeMenu}>
              <i className="bi bi-gear"></i> <h3>{t("menu.configuration")}</h3>
            </Link>
            <div className="nav-phone-line">
              <i
                className="bi bi-telephone toolbar-icon"
                title="Ligne téléphonique intelligente"
                aria-hidden="true"
              />
              <PhoneToggle />
            </div>
          </div>
        </div>

        <div className="featLinks-container">
          <Link className="myAccount" to="/profile" onClick={closeMenu}>
            <i className="bi bi-person-badge"></i>
            <h3>{t("menu.myAccount")}</h3>
          </Link>
          {isAdmin() && (
            <>
              <Link className="admin" to="/admin" onClick={closeMenu}>
                <i className="bi bi-person-gear"></i>
                <h3>{t("menu.adminPanel")}</h3>
              </Link>
              <Link
                className="admin-services"
                to="/admin/services"
                onClick={closeMenu}
              >
                <i className="bi bi-activity"></i>
                <h3>{t("menu.serviceMonitoring")}</h3>
              </Link>
            </>
          )}
        </div>
        <button
          className="logout"
          onClick={() => {
            closeMenu();
            handleLogout();
          }}
        >
          <i className="bi bi-box-arrow-right"></i>
          <h3>{t("menu.logout")}</h3>
        </button>
      </nav>
    </>
  );
}

export default Menu;
