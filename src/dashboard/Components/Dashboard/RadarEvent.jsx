/**
 * Un événement dans la timeline du radar (réservation ou commande takeaway).
 * reservation → bleu, takeaway → orange.
 */
function RadarEvent({ event }) {
  const isReservation = event.type === "reservation";
  const label = isReservation
    ? `Réservation (${event.guests ?? 0} pers)`
    : "Commande takeaway";

  return (
    <div className={`radar-event radar-event--${event.type}`}>
      <span className="radar-event__dot" aria-hidden />
      <div className="radar-event__content">
        <span className="radar-event__time">{event.time}</span>
        <span className="radar-event__label">{label}</span>
      </div>
    </div>
  );
}

export default RadarEvent;
