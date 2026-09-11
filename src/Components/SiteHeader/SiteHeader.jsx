import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./SiteHeader.scss";

function SiteHeader({ isLoggedIn, hasDashboard, displayName }) {
  const { t } = useTranslation();

  return (
    <header className="site-header">
      <Link to="/" className="site-header__brand">
        {t("site.brand")}
      </Link>
      <nav className="site-header__nav">
        <Link to="/tarifs">{t("site.nav.pricing")}</Link>
        {isLoggedIn ? (
          <>
            <Link to="/mon-espace">{displayName || t("site.nav.account")}</Link>
            {hasDashboard && <Link to="/app">{t("site.nav.dashboard")}</Link>}
          </>
        ) : (
          <>
            <Link to="/login">{t("site.nav.login")}</Link>
            <Link to="/register" className="site-header__cta">
              {t("site.nav.register")}
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

export default SiteHeader;
