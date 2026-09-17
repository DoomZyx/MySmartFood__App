import React from "react";
import { Link } from "react-router-dom";
import { formatOpsDate, KIND_LABELS } from "../../utils/platformOpsLanes";
import "./PlatformOpsBoard.scss";

function LaneButton({ lane, current, onSelect }) {
  const active = lane.id === current;
  return (
    <button
      type="button"
      className={active ? "platform-ops-lane is-active" : "platform-ops-lane"}
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(lane.id)}
    >
      <span>{lane.label}</span>
      {lane.count != null && <strong>{lane.count}</strong>}
    </button>
  );
}

function OpsCard({ item, selected, onSelect }) {
  const progress = item.progress;
  return (
    <button
      type="button"
      className={selected ? "platform-ops-card is-selected" : "platform-ops-card"}
      onClick={() => onSelect(item)}
    >
      <div className="platform-ops-card-top">
        <span className={`platform-ops-kind platform-ops-kind-${item.kind}`}>
          {KIND_LABELS[item.kind] || item.kind}
        </span>
        <span className="platform-ops-status">{item.status}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.subtitle}</p>
      {progress && progress.total > 0 && (
        <div
          className="platform-ops-progress"
          aria-label={`${progress.done} sur ${progress.total} points validés`}
        >
          <span style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
        </div>
      )}
      <div className="platform-ops-card-meta">
        <span>{item.source || KIND_LABELS[item.kind]}</span>
        <span>{formatOpsDate(item.date)}</span>
      </div>
    </button>
  );
}

const PlatformOpsBoard = ({
  groups,
  lane,
  onLaneChange,
  items,
  selectedId,
  onSelectItem,
  isLoading,
  error,
  emptyLabel,
  hideList,
  children,
}) => {
  return (
    <div className={hideList ? "platform-ops is-create" : "platform-ops"}>
      <aside className="platform-ops-rail" aria-label="États des demandes">
        {groups.map((group) => (
          <section key={group.title}>
            <h2>{group.title}</h2>
            {group.lanes.map((entry) => (
              <LaneButton
                key={entry.id}
                lane={entry}
                current={lane}
                onSelect={onLaneChange}
              />
            ))}
          </section>
        ))}
        <Link to="/" className="platform-ops-home">
          Accueil
        </Link>
      </aside>

      {!hideList && (
        <section className="platform-ops-list" aria-label="File de demandes">
          {error && (
            <p className="platform-admin-error" role="alert">
              {error}
            </p>
          )}
          {isLoading && <p className="platform-ops-empty">Chargement...</p>}
          {!isLoading && items.length === 0 && (
            <p className="platform-ops-empty">{emptyLabel}</p>
          )}
          <div className="platform-ops-cards">
            {items.map((item) => (
              <OpsCard
                key={`${item.kind}-${item.id}`}
                item={item}
                selected={selectedId === `${item.kind}-${item.id}`}
                onSelect={onSelectItem}
              />
            ))}
          </div>
        </section>
      )}

      <section className="platform-ops-detail" aria-live="polite">
        {children}
      </section>
    </div>
  );
};

export default PlatformOpsBoard;
