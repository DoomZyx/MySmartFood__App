/**
 * Timeline des 60 prochaines minutes : réservations et commandes takeaway.
 * Alerte "Pic de service imminent" si plus de 3 événements dans les 30 min.
 */
import RadarEvent from "./RadarEvent";

const MAX_EVENTS = 6;
const PEAK_THRESHOLD_MINUTES = 30;
const PEAK_EVENTS_MIN = 4;

function getEventsInNextMinutes(events, nowMinutes, windowMinutes) {
  return events.filter((e) => {
    const [h, m] = e.time.split(":").map(Number);
    const eventMinutes = h * 60 + m;
    const diff = eventMinutes - nowMinutes;
    return diff >= 0 && diff <= windowMinutes;
  });
}

function ServiceRadar({ events = [] }) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const inNext30 = getEventsInNextMinutes(events, nowMinutes, PEAK_THRESHOLD_MINUTES);
  const showPeakAlert = inNext30.length >= PEAK_EVENTS_MIN;
  const displayEvents = events.slice(0, MAX_EVENTS);

  return (
    <div className="dashboard-block dashboard-block--radar">
      <h3 className="dashboard-block__title">Radar du service</h3>
      {showPeakAlert && (
        <div className="dashboard-radar__alert" role="alert">
          <span aria-hidden>\u26A0</span> Pic de service imminent
        </div>
      )}
      <div className="dashboard-radar__timeline">
        {displayEvents.length === 0 ? (
          <p className="dashboard-block__empty">Aucun événement dans l'heure</p>
        ) : (
          displayEvents.map((event, index) => (
            <RadarEvent key={`${event.time}-${event.type}-${index}`} event={event} />
          ))
        )}
      </div>
    </div>
  );
}

export default ServiceRadar;
