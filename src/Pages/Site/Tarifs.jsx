import { useTranslation } from "react-i18next";
import SiteLayout from "./SiteLayout";
import { useTarifs } from "../../Hooks/Site/useTarifs";
import "./Tarifs.scss";

function formatPrice(cents) {
  if (cents == null) return "";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(cents) / 100);
}

function Tarifs() {
  const { t } = useTranslation();
  const { plans, loading, checkoutSlug, error, cancelled, subscribe } = useTarifs();

  return (
    <SiteLayout>
      <section className="site-tarifs">
        <h1>{t("site.tarifs.title")}</h1>
        <p>{t("site.tarifs.subtitle")}</p>
        {cancelled && <p className="site-tarifs__notice">{t("site.tarifs.cancelled")}</p>}
        {error && <p className="site-tarifs__error">{error}</p>}
        {loading ? (
          <p>{t("common.loading")}</p>
        ) : (
          <div className="site-tarifs__grid">
            {plans.map((plan) => (
              <article key={plan.id || plan.slug} className="site-tarifs__card">
                <h2>{plan.name}</h2>
                <p className="site-tarifs__price">{formatPrice(plan.priceCents)}</p>
                {plan.monthlyCallMinutes != null && (
                  <p>{t("site.tarifs.minutes", { count: plan.monthlyCallMinutes })}</p>
                )}
                <button
                  type="button"
                  disabled={Boolean(checkoutSlug)}
                  onClick={() => subscribe(plan)}
                >
                  {checkoutSlug === plan.slug ? t("site.tarifs.redirecting") : t("site.tarifs.subscribe")}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}

export default Tarifs;
