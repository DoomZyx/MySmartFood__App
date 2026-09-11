import { useTranslation } from "react-i18next";
import AppLayout from "../../Components/Layout/AppLayout";
import { useServiceHealth } from "../../Hooks/Admin/useServiceHealth";
import "./ServiceHealth.scss";

const SERVICE_ICONS = {
  backend: "bi-server",
  mongo: "bi-database",
  gateway: "bi-diagram-3",
  voice: "bi-telephone",
  stt: "bi-mic",
  llm: "bi-cpu",
  tts: "bi-volume-up",
};

function formatDateTime(value, language) {
  if (!value) return null;
  return new Intl.DateTimeFormat(language, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatDuration(durationMs) {
  if (durationMs === null) return null;
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`;
}

function translateReason(reason, t) {
  if (!reason) return null;
  return t(`monitoring.reasons.${reason}`, { defaultValue: reason });
}

function StatusLabel({ status, t }) {
  return (
    <span className={`service-health__status service-health__status--${status}`}>
      <span className="service-health__status-dot" aria-hidden="true" />
      {t(`monitoring.status.${status}`)}
    </span>
  );
}

function ServiceHealth() {
  const { t, i18n } = useTranslation();
  const {
    monitoring,
    loading,
    refreshing,
    error,
    lastUpdatedAt,
    isStale,
    refresh,
  } = useServiceHealth();

  if (loading && !monitoring) {
    return (
      <AppLayout
        title={t("monitoring.title")}
        subtitle={t("monitoring.subtitle")}
      >
        <div className="service-health__state" role="status" aria-live="polite">
          <span className="spinner spinner-lg" aria-hidden="true" />
          <p>{t("monitoring.loading")}</p>
        </div>
      </AppLayout>
    );
  }

  if (!monitoring) {
    return (
      <AppLayout
        title={t("monitoring.title")}
        subtitle={t("monitoring.subtitle")}
      >
        <div className="service-health__state service-health__state--error" role="alert">
          <i className="bi bi-exclamation-triangle" aria-hidden="true" />
          <h2>{t("monitoring.errorTitle")}</h2>
          <p>{t(error || "monitoring.errors.fetchFailed")}</p>
          <button type="button" className="service-health__retry" onClick={refresh}>
            {t("common.retry")}
          </button>
        </div>
      </AppLayout>
    );
  }

  const displayedUpdate = monitoring.serverUpdatedAt || lastUpdatedAt;

  return (
    <AppLayout
      title={t("monitoring.title")}
      subtitle={t("monitoring.subtitle")}
    >
      <div className="service-health">
        {error && (
          <div className="service-health__error-banner" role="alert">
            <i className="bi bi-exclamation-triangle" aria-hidden="true" />
            <span>{t(error)}</span>
            <button type="button" onClick={refresh}>
              {t("common.retry")}
            </button>
          </div>
        )}

        <section
          className={`service-health__summary service-health__summary--${monitoring.globalStatus}`}
          aria-labelledby="monitoring-global-title"
        >
          <div>
            <p className="service-health__eyebrow" id="monitoring-global-title">
              {t("monitoring.globalStatus")}
            </p>
            <div className="service-health__global-line">
              <StatusLabel status={monitoring.globalStatus} t={t} />
              {monitoring.fallbackOpenAI && (
                <span className="service-health__fallback">
                  {t("monitoring.fallbackOpenAI")}
                </span>
              )}
            </div>
          </div>

          <div className="service-health__updated" aria-live="polite">
            <span>{t("monitoring.lastUpdated")}</span>
            <strong>
              {formatDateTime(displayedUpdate, i18n.language) ||
                t("monitoring.notAvailable")}
            </strong>
            <span
              className={`service-health__freshness ${
                isStale
                  ? "service-health__freshness--stale"
                  : "service-health__freshness--fresh"
              }`}
            >
              {isStale ? t("monitoring.stale") : t("monitoring.fresh")}
            </span>
            {refreshing && (
              <span className="service-health__refreshing" role="status">
                <span className="spinner" aria-hidden="true" />
                {t("monitoring.refreshing")}
              </span>
            )}
          </div>
        </section>

        {monitoring.empty && (
          <div className="service-health__empty-notice" role="status">
            <i className="bi bi-inbox" aria-hidden="true" />
            {t("monitoring.emptyPayload")}
          </div>
        )}

        <section aria-labelledby="monitoring-services-title">
          <div className="service-health__section-heading">
            <div>
              <p className="service-health__eyebrow">
                {t("monitoring.infrastructure")}
              </p>
              <h2 id="monitoring-services-title">{t("monitoring.servicesTitle")}</h2>
            </div>
          </div>

          <div className="service-health__services">
            {monitoring.services.map((service) => (
              <article
                className={`service-health__service-card service-health__service-card--${service.status}`}
                key={service.key}
              >
                <header>
                  <span className="service-health__service-icon" aria-hidden="true">
                    <i className={`bi ${SERVICE_ICONS[service.key]}`} />
                  </span>
                  <div>
                    <h3>{t(`monitoring.services.${service.key}`)}</h3>
                    <StatusLabel status={service.status} t={t} />
                  </div>
                </header>

                <dl>
                  <div>
                    <dt>{t("monitoring.latency")}</dt>
                    <dd>
                      {service.latencyMs === null
                        ? t("monitoring.notAvailable")
                        : `${Math.round(service.latencyMs)} ms`}
                    </dd>
                  </div>
                  {service.provider && (
                    <div>
                      <dt>{t("monitoring.provider")}</dt>
                      <dd>{service.provider}</dd>
                    </div>
                  )}
                  {service.model && (
                    <div>
                      <dt>{t("monitoring.model")}</dt>
                      <dd>{service.model}</dd>
                    </div>
                  )}
                </dl>

                {service.message && (
                  <p className="service-health__service-message">
                    {translateReason(service.message, t)}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        <div className="service-health__details-grid">
          <section
            className="service-health__panel"
            aria-labelledby="monitoring-calls-title"
          >
            <header className="service-health__panel-header">
              <div>
                <p className="service-health__eyebrow">
                  {t("monitoring.liveActivity")}
                </p>
                <h2 id="monitoring-calls-title">{t("monitoring.activeCalls")}</h2>
              </div>
              <span className="service-health__count">
                {monitoring.activeCalls.length}
              </span>
            </header>

            {monitoring.activeCalls.length === 0 ? (
              <div className="service-health__panel-empty">
                <i className="bi bi-telephone-x" aria-hidden="true" />
                <p>{t("monitoring.noActiveCalls")}</p>
              </div>
            ) : (
              <ul className="service-health__call-list">
                {monitoring.activeCalls.map((call) => (
                  <li key={call.id}>
                    <div className="service-health__call-id">
                      <span>{t("monitoring.callId")}</span>
                      <code>{call.id}</code>
                    </div>
                    <dl>
                      <div>
                        <dt>{t("monitoring.route")}</dt>
                        <dd>{call.route || t("monitoring.notAvailable")}</dd>
                      </div>
                      <div>
                        <dt>{t("monitoring.step")}</dt>
                        <dd>{call.step || t("monitoring.notAvailable")}</dd>
                      </div>
                      <div>
                        <dt>{t("monitoring.duration")}</dt>
                        <dd>
                          {formatDuration(call.durationMs) ||
                            t("monitoring.notAvailable")}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("monitoring.provider")}</dt>
                        <dd>{call.provider || t("monitoring.notAvailable")}</dd>
                      </div>
                      {call.lastError && (
                        <div>
                          <dt>{t("monitoring.lastError")}</dt>
                          <dd>{translateReason(call.lastError, t)}</dd>
                        </div>
                      )}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="service-health__panel"
            aria-labelledby="monitoring-alerts-title"
          >
            <header className="service-health__panel-header">
              <div>
                <p className="service-health__eyebrow">
                  {t("monitoring.events")}
                </p>
                <h2 id="monitoring-alerts-title">{t("monitoring.recentAlerts")}</h2>
              </div>
              <span className="service-health__count">{monitoring.alerts.length}</span>
            </header>

            {monitoring.alerts.length === 0 ? (
              <div className="service-health__panel-empty">
                <i className="bi bi-check-circle" aria-hidden="true" />
                <p>{t("monitoring.noRecentAlerts")}</p>
              </div>
            ) : (
              <ul className="service-health__alert-list">
                {monitoring.alerts.map((alert) => (
                  <li
                    className={`service-health__alert service-health__alert--${alert.severity}`}
                    key={alert.id}
                  >
                    <span className="service-health__alert-marker" aria-hidden="true" />
                    <div>
                      <div className="service-health__alert-meta">
                        <strong>
                          {alert.service || t("monitoring.system")}
                        </strong>
                        <time dateTime={alert.timestamp || undefined}>
                          {formatDateTime(alert.timestamp, i18n.language) ||
                            t("monitoring.notAvailable")}
                        </time>
                      </div>
                      <p>{alert.message || t("monitoring.alertWithoutMessage")}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}

export default ServiceHealth;
