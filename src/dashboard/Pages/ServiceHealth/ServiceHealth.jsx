import { useTranslation } from "react-i18next";
import TokenUsageList from "../../Components/Dashboard/TokenUsageList";
import { useServiceHealth } from "../../Hooks/Admin/useServiceHealth";
import { useTokenUsage } from "../../Hooks/Dashboard/useTokenUsage";
import "./ServiceHealth.scss";

const SERVICE_ICONS = {
  postgres: "bi-database",
  gateway: "bi-diagram-3",
  voice: "bi-telephone",
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

function formatMs(value, t) {
  if (value === null || value === undefined) return t("monitoring.notAvailable");
  return `${Math.round(value)} ms`;
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
  const tokenUsage = useTokenUsage();

  if (loading && !monitoring) {
    return (
      <div className="service-health__state" role="status" aria-live="polite">
        <span className="spinner spinner-lg" aria-hidden="true" />
        <p>{t("monitoring.loading")}</p>
      </div>
    );
  }

  if (!monitoring) {
    return (
      <div className="service-health__state service-health__state--error" role="alert">
        <i className="bi bi-exclamation-triangle" aria-hidden="true" />
        <h2>{t("monitoring.errorTitle")}</h2>
        <p>{t(error || "monitoring.errors.fetchFailed")}</p>
        <button type="button" className="service-health__retry" onClick={refresh}>
          {t("common.retry")}
        </button>
      </div>
    );
  }

  const displayedUpdate = monitoring.serverUpdatedAt || lastUpdatedAt;
  const latencies = monitoring.latencies || [];

  return (
    <div className="service-health">
        <div className="title-section">
          <h1>{t("monitoring.title")}</h1>
          <p className="subtitle">{t("monitoring.subtitle")}</p>
        </div>
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

        <TokenUsageList
          events={tokenUsage.events}
          totals={tokenUsage.totals}
          loading={tokenUsage.loading}
          error={tokenUsage.error}
        />

        <section
          className="service-health__panel"
          aria-labelledby="monitoring-latency-title"
        >
          <header className="service-health__panel-header">
            <div>
              <p className="service-health__eyebrow">
                {t("monitoring.latencySection")}
              </p>
              <h2 id="monitoring-latency-title">{t("monitoring.latencyTitle")}</h2>
            </div>
          </header>

          <ul className="service-health__call-list">
            {latencies.map((hop) => (
              <li key={hop.key}>
                <div className="service-health__call-id">
                  <span>{t(`monitoring.latencies.${hop.key}`)}</span>
                  <code>{formatMs(hop.last, t)}</code>
                </div>
                {hop.measured && hop.average != null ? (
                  <dl>
                    <div>
                      <dt>{t("monitoring.last")}</dt>
                      <dd>{formatMs(hop.last, t)}</dd>
                    </div>
                    <div>
                      <dt>{t("monitoring.average")}</dt>
                      <dd>{formatMs(hop.average, t)}</dd>
                    </div>
                    {hop.max != null && (
                      <div>
                        <dt>{t("monitoring.max")}</dt>
                        <dd>{formatMs(hop.max, t)}</dd>
                      </div>
                    )}
                  </dl>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section
          className="service-health__panel"
          aria-labelledby="monitoring-callflow-title"
        >
          <header className="service-health__panel-header">
            <div>
              <p className="service-health__eyebrow">
                {t("monitoring.callFlowSection")}
              </p>
              <h2 id="monitoring-callflow-title">{t("monitoring.callFlowTitle")}</h2>
            </div>
            <span className="service-health__count">
              {(monitoring.callFlow || []).length}
            </span>
          </header>

          {(monitoring.callFlow || []).length === 0 ? (
            <div className="service-health__panel-empty">
              <i className="bi bi-telephone-x" aria-hidden="true" />
              <p>{t("monitoring.noCallFlow")}</p>
            </div>
          ) : (
            <ul className="service-health__alert-list">
              {(monitoring.callFlow || []).map((event) => (
                <li
                  className={`service-health__alert service-health__alert--${event.severity}`}
                  key={event.id}
                >
                  <span className="service-health__alert-marker" aria-hidden="true" />
                  <div>
                    <div className="service-health__alert-meta">
                      <strong>
                        {t(`monitoring.callFlowStages.${event.stage}`, {
                          defaultValue: event.stage,
                        })}
                        {" — "}
                        {t(`monitoring.callFlowOutcomes.${event.outcome}`, {
                          defaultValue: event.outcome,
                        })}
                      </strong>
                      <time dateTime={event.at || undefined}>
                        {formatDateTime(event.at, i18n.language) ||
                          t("monitoring.notAvailable")}
                      </time>
                    </div>
                    <p>
                      {[
                        event.to ? `${t("monitoring.callFlowTo")} ${event.to}` : null,
                        event.fromMasked
                          ? `${t("monitoring.callFlowFrom")} ${event.fromMasked}`
                          : null,
                        event.slug || null,
                        event.detail,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

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
            {monitoring.services.map((service) => {
              const status =
                service.key === "voice" &&
                (service.fallbackAvailable || monitoring.fallbackOpenAI)
                  ? "healthy"
                  : service.status;
              return (
              <article
                className={`service-health__service-card service-health__service-card--${status}`}
                key={service.key}
              >
                <header>
                  <span className="service-health__service-icon" aria-hidden="true">
                    <i className={`bi ${SERVICE_ICONS[service.key]}`} />
                  </span>
                  <div>
                    <h3>{t(`monitoring.services.${service.key}`)}</h3>
                    <StatusLabel status={status} t={t} />
                    {service.key === "voice" && (
                      <span className="service-health__fallback">
                        {t("monitoring.fallback")}
                      </span>
                    )}
                  </div>
                </header>

                {service.message && status !== "healthy" && (
                  <p className="service-health__service-message">
                    {translateReason(service.message, t)}
                  </p>
                )}
              </article>
              );
            })}
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
                    <dl>
                      <div>
                        <dt>{t("monitoring.duration")}</dt>
                        <dd>
                          {formatDuration(call.durationMs) ||
                            t("monitoring.notAvailable")}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("monitoring.step")}</dt>
                        <dd>{call.step || t("monitoring.notAvailable")}</dd>
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

          {monitoring.alerts.length > 0 && (
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
            </section>
          )}
        </div>
      </div>
  );
}

export default ServiceHealth;
