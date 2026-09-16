import "./dashboard.scss";

function formatTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function sourceLabel(source) {
  if (source === "extraction") return "Extraction";
  return "Appel vocal";
}

export function TokenUsageList({ events = [], totals = {}, loading, error }) {
  if (loading) {
    return (
      <div className="dashboard-block">
        <h3 className="dashboard-block__title">Tokens de l'instance</h3>
        <p className="dashboard-block__empty">Chargement de l'usage…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-block">
        <h3 className="dashboard-block__title">Tokens de l'instance</h3>
        <p className="dashboard-block__empty">{error}</p>
      </div>
    );
  }

  return (
    <div className="dashboard-block">
      <h3 className="dashboard-block__title">Tokens de l'instance</h3>
      <div className="dashboard-agent__grid">
        <div className="dashboard-card dashboard-card--stat">
          <span className="dashboard-card__value">{totals.inputTokens || 0}</span>
          <span className="dashboard-card__label">Input</span>
        </div>
        <div className="dashboard-card dashboard-card--stat">
          <span className="dashboard-card__value">{totals.outputTokens || 0}</span>
          <span className="dashboard-card__label">Output</span>
        </div>
        <div className="dashboard-card dashboard-card--stat">
          <span className="dashboard-card__value">{totals.totalTokens || 0}</span>
          <span className="dashboard-card__label">Total</span>
        </div>
      </div>
      {events.length === 0 ? (
        <p className="dashboard-block__empty">Aucun usage LLM enregistré pour le moment.</p>
      ) : (
        <div className="dashboard-block__list">
          {events.map((event) => (
            <div key={event.id} className="dashboard-card">
              <div className="dashboard-card__header">
                <span className="dashboard-card__id">{sourceLabel(event.source)}</span>
                <span className="dashboard-card__meta">{formatTime(event.createdAt)}</span>
              </div>
              <div className="dashboard-card__body">
                <span className="dashboard-card__client">
                  {event.provider}
                  {event.model ? ` · ${event.model}` : ""}
                </span>
                <span className="dashboard-card__meta">
                  in {event.inputTokens} · out {event.outputTokens}
                  {event.latencyMs != null ? ` · ${event.latencyMs} ms` : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TokenUsageList;
