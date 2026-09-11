import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SiteLayout from "./SiteLayout";
import { useMonEspace } from "../../Hooks/Site/useMonEspace";
import "./MonEspace.scss";

function MonEspace() {
  const { t } = useTranslation();
  const {
    loading,
    isLoggedIn,
    user,
    hasDashboard,
    hasActiveSubscription,
    checkoutSuccess,
    resending,
    resendMessage,
    resendError,
    resendLink,
  } = useMonEspace();

  return (
    <SiteLayout>
      <section className="site-espace">
        <h1>{t("site.account.title")}</h1>
        {loading && <p>{t("common.loading")}</p>}
        {!loading && !isLoggedIn && (
          <p>
            {t("site.account.needLogin")}{" "}
            <Link to="/login">{t("site.nav.login")}</Link>
          </p>
        )}
        {!loading && isLoggedIn && (
          <>
            <p>{t("site.account.hello", { name: user?.name || user?.email || "" })}</p>
            {checkoutSuccess && <p className="site-espace__notice">{t("site.account.checkoutSuccess")}</p>}
            {hasDashboard ? (
              <p>
                {t("site.account.activePlan", { plan: user?.planSlug || t("site.account.planFallback") })}
              </p>
            ) : hasActiveSubscription ? (
              <p>{t("site.account.waitingToken")}</p>
            ) : (
              <p>{t("site.account.noPlan")}</p>
            )}
            {resendMessage === "sent" && <p className="site-espace__notice">{t("site.account.resendOk")}</p>}
            {resendError && <p className="site-espace__error">{resendError}</p>}
            <div className="site-espace__actions">
              {hasDashboard ? (
                <Link to="/app">{t("site.nav.dashboard")}</Link>
              ) : (
                <Link to="/tarifs">{t("site.nav.pricing")}</Link>
              )}
              {hasActiveSubscription && !hasDashboard && (
                <button type="button" disabled={resending} onClick={resendLink}>
                  {resending ? t("site.account.resending") : t("site.account.resend")}
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </SiteLayout>
  );
}

export default MonEspace;
