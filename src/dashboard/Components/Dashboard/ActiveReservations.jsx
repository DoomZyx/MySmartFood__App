/**
 * Affiche les réservations du moment.
 * Données : heure, nombre de personnes, table (si disponible).
 */
function ActiveReservations({ reservations = [] }) {
  if (!reservations.length) {
    return (
      <div className="dashboard-block dashboard-block--reservations">
        <h3 className="dashboard-block__title">Réservations en cours</h3>
        <p className="dashboard-block__empty">Aucune réservation en cours</p>
      </div>
    );
  }

  return (
    <div className="dashboard-block dashboard-block--reservations">
      <h3 className="dashboard-block__title">Réservations en cours</h3>
      <div className="dashboard-block__list">
        {reservations.map((reservation, index) => (
          <div key={index} className="dashboard-card dashboard-card--reservation">
            <span className="dashboard-card__time">{reservation.time}</span>
            <span className="dashboard-card__separator">—</span>
            {reservation.table && (
              <>
                <span className="dashboard-card__table">{reservation.table}</span>
                <span className="dashboard-card__separator">—</span>
              </>
            )}
            <span className="dashboard-card__guests">{reservation.guests} personne{reservation.guests > 1 ? "s" : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ActiveReservations;
