import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SiteLayout from "./SiteLayout";
import "./Landing.scss";

function Landing() {
  const { t } = useTranslation();

  return (
    <SiteLayout>
      <section className="site-landing">
        <h1>{t("site.landing.title")}</h1>
        <p>{t("site.landing.subtitle")}</p>
        <div className="site-landing__actions">
          <Link to="/tarifs" className="site-landing__btn">
            {t("site.landing.seePlans")}
          </Link>
          <Link to="/login" className="site-landing__btn site-landing__btn--ghost">
            {t("site.landing.login")}
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}

export default Landing;
