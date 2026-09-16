/**
 * Affiche les commandes actives (en préparation / prêtes).
 * Données : id, client, type (takeaway / livraison), statut, heure.
 */
function ActiveOrders({ orders = [] }) {
  if (!orders.length) {
    return (
      <div className="dashboard-block dashboard-block--orders">
        <h3 className="dashboard-block__title">Commandes en cours</h3>
        <p className="dashboard-block__empty">Aucune commande en cours</p>
      </div>
    );
  }

  return (
    <div className="dashboard-block dashboard-block--orders">
      <h3 className="dashboard-block__title">Commandes en cours</h3>
      <div className="dashboard-block__list">
        {orders.map((order) => (
          <div key={order.id} className="dashboard-card dashboard-card--order">
            <div className="dashboard-card__header">
              <span className="dashboard-card__id">Commande #{order.id}</span>
              <span className={`dashboard-card__status dashboard-card__status--${order.type}`}>
                {order.status}
              </span>
            </div>
            <div className="dashboard-card__body">
              <span className="dashboard-card__client">{order.client}</span>
              <span className="dashboard-card__meta">
                {order.type === "takeaway" ? "À emporter" : "Livraison"} · {order.time}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ActiveOrders;
