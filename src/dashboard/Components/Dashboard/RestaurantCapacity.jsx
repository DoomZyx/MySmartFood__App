/**
 * Charge du restaurant : places occupées / total + barre de progression.
 */
function RestaurantCapacity({ capacity = { occupied: 0, total: 0 } }) {
  const { occupied = 0, total = 1 } = capacity;
  const remaining = Math.max(0, total - occupied);
  const percent = total > 0 ? Math.min(100, Math.round((occupied / total) * 100)) : 0;

  return (
    <div className="dashboard-block dashboard-block--capacity">
      <h3 className="dashboard-block__title">Charge du restaurant</h3>
      <div className="dashboard-capacity__values">
        <span className="dashboard-capacity__main">
          {occupied} / {total} places occupées
        </span>
        <span className="dashboard-capacity__remaining">{remaining} places restantes</span>
      </div>
      <div className="dashboard-capacity__bar-wrap" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="dashboard-capacity__bar" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default RestaurantCapacity;
