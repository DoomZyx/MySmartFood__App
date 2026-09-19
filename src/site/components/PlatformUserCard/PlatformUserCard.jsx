import React from "react";
import { formatOpsDate, platformUserDeleteReason } from "../../utils/platformOpsLanes";
import "../PlatformStaffEditor/PlatformStaffEditor.scss";

function initials(name, email) {
  const source = String(name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

const PlatformUserCard = ({
  item,
  selected,
  actor,
  busy,
  onEdit,
  onDelete,
}) => {
  const user = item.raw || {};
  const blockReason = platformUserDeleteReason(actor, user);
  const className = [
    "puc",
    selected ? "is-selected" : "",
    busy ? "is-busy" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={className}>
      <button type="button" className="puc-main" onClick={() => onEdit(item)}>
        <span className="puc-avatar" aria-hidden="true">
          {initials(item.title, item.subtitle)}
        </span>
        <span className="puc-body">
          <span className="puc-top">
            <span className="puc-name">{item.title}</span>
            <span className="pse-badge">{item.status}</span>
          </span>
          <span className="puc-email">{item.subtitle}</span>
          <span className="puc-meta">
            <span>{item.source || "Aucun restaurant"}</span>
            <span>{formatOpsDate(item.date)}</span>
          </span>
        </span>
      </button>
      <div className="puc-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => onEdit(item)}
        >
          Modifier
        </button>
        <button
          type="button"
          className="btn btn-secondary puc-delete"
          disabled={busy || Boolean(blockReason)}
          title={blockReason || "Supprimer le compte"}
          onClick={() => onDelete?.(item)}
        >
          Supprimer
        </button>
      </div>
    </article>
  );
};

export default PlatformUserCard;
