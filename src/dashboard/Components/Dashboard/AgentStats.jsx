/**
 * Activité de l'agent vocal : appels, commandes et réservations créées.
 */
function AgentStats({ stats = {} }) {
  const { callsHandled = 0, ordersCreated = 0, reservationsCreated = 0 } = stats;

  const items = [
    { label: "Appels gérés aujourd'hui", value: callsHandled, key: "calls" },
    { label: "Commandes créées", value: ordersCreated, key: "orders" },
    { label: "Réservations créées", value: reservationsCreated, key: "reservations" },
  ];

  return (
    <div className="dashboard-block dashboard-block--agent">
      <h3 className="dashboard-block__title">Activité de l'agent vocal</h3>
      <div className="dashboard-agent__grid">
        {items.map(({ label, value, key }) => (
          <div key={key} className="dashboard-card dashboard-card--stat">
            <span className="dashboard-card__value">{value}</span>
            <span className="dashboard-card__label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AgentStats;
