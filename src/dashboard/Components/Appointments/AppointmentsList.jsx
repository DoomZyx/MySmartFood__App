import { useTranslation } from "react-i18next";
import { useMemo, useState, useRef, useCallback } from "react";
import { getClientFullName, getClientPhone } from "../../utils/clientUtils";

const DRAG_TYPE = "application/x-smartcrm-reservation";
const LONG_PRESS_MS = 300;
const MOVE_THRESHOLD_PX = 28;
const EDGE_SCROLL_MARGIN = 80;
const EDGE_SCROLL_STEP = 14;

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function AppointmentsList({
  appointments,
  loading,
  error,
  pagination,
  onViewDetails,
  onStatusChange,
  onDelete,
  formatDateTime,
  getStatusBadge,
  variant,
  enableDragDrop = false,
  touchDraggingId = null,
  onLongPressStart,
  onTouchDragMove,
  onTouchDragEnd,
}) {
  const { t } = useTranslation();
  const [draggedId, setDraggedId] = useState(null);
  const longPressTimerRef = useRef(null);
  const startPosRef = useRef(null);
  const cancelMoveRef = useRef(null);
  const cancelUpRef = useRef(null);
  const blockScrollRef = useRef(null);

  /** Pour variant reservations ou orders : grouper par tranche horaire (heure) */
  const appointmentsByTime = useMemo(() => {
    if ((variant !== "reservations" && variant !== "orders") || !appointments.length) return null;
    const sorted = [...appointments].sort((a, b) => (a.heure || "").localeCompare(b.heure || ""));
    const groups = {};
    sorted.forEach((apt) => {
      const key = apt.heure || "--:--";
      if (!groups[key]) groups[key] = [];
      groups[key].push(apt);
    });
    return groups;
  }, [appointments, variant]);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (cancelMoveRef.current) {
      document.removeEventListener("pointermove", cancelMoveRef.current, true);
      cancelMoveRef.current = null;
    }
    if (cancelUpRef.current) {
      document.removeEventListener("pointerup", cancelUpRef.current, true);
      document.removeEventListener("pointercancel", cancelUpRef.current, true);
      cancelUpRef.current = null;
    }
    if (blockScrollRef.current) {
      document.removeEventListener("pointermove", blockScrollRef.current, true);
      blockScrollRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const handlePointerDown = useCallback(
    (e, appointment) => {
      if (!enableDragDrop || e.pointerType !== "touch") return;
      e.preventDefault();
      startPosRef.current = { x: e.clientX, y: e.clientY };

      const blockScroll = (eMove) => {
        eMove.preventDefault();
      };
      blockScrollRef.current = blockScroll;
      document.addEventListener("pointermove", blockScroll, { capture: true, passive: false });

      const cancelMove = (eMove) => {
        if (startPosRef.current && distance(eMove.clientX, eMove.clientY, startPosRef.current.x, startPosRef.current.y) > MOVE_THRESHOLD_PX) {
          clearLongPress();
        }
      };
      const cancelUp = () => {
        clearLongPress();
      };

      cancelMoveRef.current = cancelMove;
      cancelUpRef.current = cancelUp;
      document.addEventListener("pointermove", cancelMove, { capture: true, passive: false });
      document.addEventListener("pointerup", cancelUp, { capture: true });
      document.addEventListener("pointercancel", cancelUp, { capture: true });

      longPressTimerRef.current = setTimeout(() => {
        const startPos = startPosRef.current;
        clearLongPress();
        onLongPressStart?.(appointment._id, startPos?.x ?? 0, startPos?.y ?? 0);

        const moveHandler = (eMove) => {
          eMove.preventDefault();
          const y = eMove.clientY;
          if (y < EDGE_SCROLL_MARGIN) {
            window.scrollBy(0, -EDGE_SCROLL_STEP);
          } else if (y > window.innerHeight - EDGE_SCROLL_MARGIN) {
            window.scrollBy(0, EDGE_SCROLL_STEP);
          }
          onTouchDragMove?.(eMove.clientX, eMove.clientY);
        };
        const upHandler = () => {
          onTouchDragEnd?.();
          document.removeEventListener("pointermove", moveHandler, true);
          document.removeEventListener("pointerup", upHandler, true);
          document.removeEventListener("pointercancel", upHandler, true);
        };
        document.addEventListener("pointermove", moveHandler, { capture: true, passive: false });
        document.addEventListener("pointerup", upHandler, { capture: true });
        document.addEventListener("pointercancel", upHandler, { capture: true });
      }, LONG_PRESS_MS);
    },
    [enableDragDrop, clearLongPress, onLongPressStart, onTouchDragMove, onTouchDragEnd]
  );

  const isDragging = useCallback(
    (appointmentId) => (enableDragDrop && (draggedId === appointmentId || touchDraggingId === appointmentId)),
    [enableDragDrop, draggedId, touchDraggingId]
  );

  if (loading) {
    return (
      <div className="loading-state">
        <i className="bi bi-arrow-repeat spinning"></i>
        {t('common.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <i className="bi bi-exclamation-triangle"></i>
        {error}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="empty-state">
        <i className="bi bi-calendar-x"></i>
        <p>{t('appointmentsList.noOrdersFound')}</p>
      </div>
    );
  }

  // Fonctions utilitaires pour le style
  const getStatusColor = (statut) => {
    const colors = {
      planifie: "status-planned",
      confirme: "status-confirmed", 
      en_cours: "status-in-progress",
      termine: "status-completed",
      annule: "status-cancelled",
    };
    return colors[statut] || "status-default";
  };

  const getStatusLabel = (statut) => {
    const labels = {
      planifie: t('appointments.statuses.planifie').toUpperCase(),
      confirme: t('appointments.statuses.confirme').toUpperCase(),
      en_cours: t('appointments.statuses.en_cours').toUpperCase(), 
      termine: t('appointments.statuses.termine').toUpperCase(),
      annule: t('appointments.statuses.annule').toUpperCase(),
    };
    return labels[statut] || statut;
  };

  const getModalityIcon = (modalite) => {
    return "";
  };

  /** Libellé selon createdBy : system = IA, sinon = réservation client */
  const getCreatedByLabel = (appointment) => {
    const by = appointment?.createdBy?.toLowerCase?.();
    return by === "system" ? t("appointmentsList.createdByAI") : t("appointmentsList.createdByClient");
  };

  const isCreatedByAI = (appointment) => (appointment?.createdBy?.toLowerCase?.() ?? "") === "system";

  /** Cycle de statut au tap : planifié → confirme → en_cours → termine → confirme (correction rapide) */
  const getNextStatus = (statut) => {
    const cycle = { planifie: "confirme", confirme: "en_cours", en_cours: "termine", termine: "confirme", annule: "planifie" };
    return cycle[statut] || "confirme";
  };

  const handleStatusBadgeClick = (e, appointment) => {
    e.stopPropagation();
    const next = getNextStatus(appointment.statut);
    onStatusChange(appointment._id, next);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  /** Total commande (plats) pour affichage card commandes à emporter */
  const getOrderTotal = (appointment) => {
    if (!appointment?.commandes?.length) return null;
    const total = appointment.commandes.reduce(
      (sum, item) => sum + (item.prixUnitaire || 0) * (item.quantite || 1),
      0
    );
    return total > 0 ? `${total.toFixed(2)} €` : null;
  };

  const handleDragStart = (e, appointment) => {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ id: appointment._id }));
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(appointment._id);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  /** Vue compacte groupée par heure : réservations (heure | personnes | nom) ou orders (heure | montant | nom) */
  if ((variant === "reservations" || variant === "orders") && appointmentsByTime) {
    return (
      <div className="appointments-list-reservations">
        {Object.entries(appointmentsByTime).map(([heure, list]) => (
          <div key={heure} className="reservations-time-group">
            <div className="reservations-time-header">{heure}</div>
            <div className="reservations-time-rows">
              {list.map((appointment) => (
                <div
                  key={appointment._id}
                  className={`reservation-row ${getStatusColor(appointment.statut)} ${isDragging(appointment._id) ? "is-dragging" : ""}`}
                  draggable={enableDragDrop}
                  onDragStart={enableDragDrop ? (e) => handleDragStart(e, appointment) : undefined}
                  onDragEnd={enableDragDrop ? handleDragEnd : undefined}
                  onPointerDown={enableDragDrop ? (e) => handlePointerDown(e, appointment) : undefined}
                  title={enableDragDrop ? t("appointmentsList.longPressToDrag") : undefined}
                >
                  <div
                    className="reservation-row-main"
                    onClick={() => onViewDetails(appointment._id)}
                  >
                    <span className="reservation-row-time">{appointment.heure}</span>
                    {variant === "reservations" ? (
                      <>
                        <span className="reservation-row-persons">
                          {appointment.nombrePersonnes ?? "-"}
                        </span>
                        <span className="reservation-row-name">
                          {getClientFullName(appointment.client, appointment)}
                        </span>
                        <span
                          className={`reservation-row-created-by ${isCreatedByAI(appointment) ? "created-by-ai" : "created-by-client"}`}
                          title={getCreatedByLabel(appointment)}
                        >
                          {getCreatedByLabel(appointment)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="reservation-row-amount">
                          {getOrderTotal(appointment) ?? "-"}
                        </span>
                        <span className="reservation-row-name">
                          {getClientFullName(appointment.client, appointment)}
                        </span>
                      </>
                    )}
                  </div>
                  <span
                    className={`reservation-row-badge clickable ${getStatusColor(appointment.statut)}`}
                    onClick={(e) => handleStatusBadgeClick(e, appointment)}
                    title={t("appointmentsList.tapToChangeStatus")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleStatusBadgeClick(e, appointment); } }}
                  >
                    {getStatusLabel(appointment.statut)}
                  </span>
                  <div className="reservation-row-actions" onClick={(e) => e.stopPropagation()}>
                    {(appointment.statut === "planifie" || appointment.statut === "confirme") && (
                      <button
                        type="button"
                        className="btn-quick-action btn-start"
                        onClick={() => onStatusChange(appointment._id, "en_cours")}
                        title={t("appointmentsList.startPreparation")}
                      >
                        {t("appointmentsList.startBtn")}
                      </button>
                    )}
                    {appointment.statut === "en_cours" && (
                      <button
                        type="button"
                        className="btn-quick-action btn-complete"
                        onClick={() => onStatusChange(appointment._id, "termine")}
                        title={t("appointmentsList.markAsComplete")}
                      >
                        {t("appointmentsList.completeBtn")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="appointments-grid">
      {appointments.map((appointment) => (
        <div
          key={appointment._id}
          className={`appointment-card-compact ${getStatusColor(appointment.statut)} ${isDragging(appointment._id) ? "is-dragging" : ""}`}
          draggable={enableDragDrop}
          onDragStart={enableDragDrop ? (e) => handleDragStart(e, appointment) : undefined}
          onDragEnd={enableDragDrop ? handleDragEnd : undefined}
          onPointerDown={enableDragDrop ? (e) => handlePointerDown(e, appointment) : undefined}
        >
          <div 
            className="card-compact-content"
            onClick={() => onViewDetails(appointment._id)}
          >
            <div className="client-name-compact">
              {getClientFullName(appointment.client, appointment)}
            </div>
            <div className="order-time-compact">
              <span className="time-label">{t('appointmentsList.expectedPickup')} :</span>
              <span className="time-value">{appointment.heure}</span>
            </div>
            <div className="order-amount-compact">
              <span className="amount-label">{t('appointmentsList.amount')} :</span>
              <span className="amount-value">{getOrderTotal(appointment) ?? "-"}</span>
            </div>
          </div>
          <span
            className={`status-badge-compact clickable ${getStatusColor(appointment.statut)}`}
            onClick={(e) => { e.stopPropagation(); handleStatusBadgeClick(e, appointment); }}
            title={t("appointmentsList.tapToChangeStatus")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleStatusBadgeClick(e, appointment); } }}
          >
            {getStatusLabel(appointment.statut)}
          </span>

          {/* Boutons d'action rapide */}
          <div className="card-quick-actions" onClick={(e) => e.stopPropagation()}>
            {(appointment.statut === 'planifie' || appointment.statut === 'confirme') && (
              <button
                className="btn-quick-action btn-start"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(appointment._id, 'en_cours');
                }}
                title={t('appointmentsList.startPreparation')}
              >
                {t('appointmentsList.startBtn')}
              </button>
            )}
            
            {appointment.statut === 'en_cours' && (
              <button
                className="btn-quick-action btn-complete"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(appointment._id, 'termine');
                }}
                title={t('appointmentsList.markAsComplete')}
              >
                {t('appointmentsList.completeBtn')}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
