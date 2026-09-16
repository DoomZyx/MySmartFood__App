import { useTranslation } from "react-i18next";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useAppointments } from "../../Hooks/Appointments/useAppointments";
import { useConfiguration } from "../../Hooks/Configuration/useConfiguration";
import { getCurrentService } from "../../utils/serviceUtils";
import AppLayout from "../../Components/Layout/AppLayout";
import { AppointmentsFilters } from "../../Components/Appointments/AppointmentsFilters";
import { AppointmentsList } from "../../Components/Appointments/AppointmentsList";
import { CreateAppointmentForm } from "../../Components/Appointments/CreateAppointmentForm";
import { AppointmentDetails } from "../../Components/Appointments/AppointmentDetails";
import { getClientFullName } from "../../utils/clientUtils";
import "../AppointmentsPage/AppointmentsPage.scss";

function getTodayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DRAG_TYPE = "application/x-smartcrm-reservation";

const ZONE_STATUS = {
  waiting: "confirme",
  "in-progress": "en_cours",
  completed: "termine",
};

function ReservationsPage() {
  const { t } = useTranslation();
  const { pricing } = useConfiguration();
  const [activeService, setActiveService] = useState("midi");
  const [dragOverZone, setDragOverZone] = useState(null);

  useEffect(() => {
    const horaires = pricing?.restaurantInfo?.horairesOuverture;
    if (!horaires) return;
    const current = getCurrentService(horaires, new Date());
    if (current?.service) setActiveService(current.service);
  }, [pricing]);
  const [touchDraggingId, setTouchDraggingId] = useState(null);
  const [dragPreviewPosition, setDragPreviewPosition] = useState(null);
  const touchDragJustEndedRef = useRef(false);
  const touchDraggingIdRef = useRef(null);
  const dragOverZoneRef = useRef(null);

  function getZoneAtPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    let node = el;
    while (node) {
      if (node.classList?.contains("appointments-zone") && node.dataset?.zone) {
        return node.dataset.zone;
      }
      node = node.parentElement;
    }
    return null;
  }

  const {
    appointments,
    loading,
    error,
    pagination,
    filters,
    handleFilterChange,
    resetFilters,
    hasActiveFilters,
    showModal,
    showCreateModal,
    selectedAppointment,
    openCreateModal,
    closeDetailsModal,
    closeCreateModal,
    handleViewDetails,
    clearError,
    formatDateTime,
    getStatusBadge,
    handleStatusChange,
    handleDeleteAppointment,
    handleCreateAppointment,
    handleEditAppointment,
    handleCalendarSelectAppointment,
    handleCalendarSelectSlot,
  } = useAppointments("reservations");

  // Fonction pour déterminer si une heure appartient au service midi ou soir
  const getServiceFromTime = (time) => {
    if (!time) return null;
    const hour = parseInt(time.split(':')[0]);
    // Midi: 11h00 - 15h00, Soir: 18h00 - 23h00
    if (hour >= 11 && hour < 15) return "midi";
    if (hour >= 18 && hour < 24) return "soir";
    return null;
  };

  // Filtrer par service (midi/soir) : les données viennent déjà de l'API réservations
  const filteredReservations = useMemo(() => {
    return appointments.filter(apt => {
      const service = getServiceFromTime(apt.heure);
      return service === activeService;
    });
  }, [appointments, activeService]);

  const capacity = pricing?.restaurantInfo?.nombreCouverts ?? null;
  const todayStr = getTodayDateStr();
  const isViewingToday = filters.date === todayStr;

  /** Réservations qui arrivent dans les 15 prochaines minutes (uniquement si on affiche le jour même) */
  const arrivingIn15Min = useMemo(() => {
    if (!isViewingToday || !filteredReservations.length) return [];
    const now = new Date();
    const in15 = new Date(now.getTime() + 15 * 60 * 1000);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const in15Min = in15.getHours() * 60 + in15.getMinutes();
    return filteredReservations
      .filter(apt => {
        if (["termine", "annule"].includes(apt.statut)) return false;
        const [h, m] = (apt.heure || "00:00").split(":").map(Number);
        const slotMin = h * 60 + m;
        return slotMin >= nowMin && slotMin <= in15Min;
      })
      .sort((a, b) => (a.heure || "").localeCompare(b.heure || ""));
  }, [filteredReservations, isViewingToday]);

  /** KPI couverts : max, réservés (hors annulés), arrivés (en_cours+termine), restants */
  const activeReservations = useMemo(() => 
    filteredReservations.filter(apt => !["annule"].includes(apt.statut)),
    [filteredReservations]
  );
  const couvertsReserves = activeReservations.reduce((sum, apt) => sum + (Number(apt.nombrePersonnes) || 0), 0);
  /** Arrivés = en_cours + terminées (les couverts restent comptés une fois arrivés) */
  const couvertsArrives = activeReservations
    .filter(apt => ["en_cours", "termine"].includes(apt.statut))
    .reduce((sum, apt) => sum + (Number(apt.nombrePersonnes) || 0), 0);
  /** Restants = capacité moins les couverts encore en occupation (planifié, confirmé, en_cours ; les terminés libèrent la place) */
  const couvertsEnOccupation = activeReservations
    .filter(apt => ["planifie", "confirme", "en_cours"].includes(apt.statut))
    .reduce((sum, apt) => sum + (Number(apt.nombrePersonnes) || 0), 0);
  const couvertsRestants = capacity != null ? Math.max(0, capacity - couvertsEnOccupation) : null;

  /** Couverts par créneau horaire (résas actives uniquement) */
  const coversPerSlot = useMemo(() => {
    const byHour = {};
    activeReservations.forEach(apt => {
      const h = apt.heure || "--:--";
      byHour[h] = (byHour[h] || 0) + (Number(apt.nombrePersonnes) || 0);
    });
    return Object.entries(byHour).sort(([a], [b]) => a.localeCompare(b));
  }, [activeReservations]);

  const handleZoneDragOver = (e, zoneKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverZone(zoneKey);
  };

  const handleZoneDragLeave = (e, zoneKey) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverZone(null);
    }
  };

  const handleZoneDrop = (e, zoneKey) => {
    e.preventDefault();
    setDragOverZone(null);
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    try {
      const { id } = JSON.parse(raw);
      const newStatus = ZONE_STATUS[zoneKey];
      if (id && newStatus) handleStatusChange(id, newStatus);
    } catch (_) {}
  };

  const handleLongPressStart = useCallback((id, clientX, clientY) => {
    touchDraggingIdRef.current = id;
    setTouchDraggingId(id);
    setDragPreviewPosition(typeof clientX === "number" && typeof clientY === "number" ? { x: clientX, y: clientY } : null);
  }, []);

  const handleTouchDragMove = useCallback((clientX, clientY) => {
    const zone = getZoneAtPoint(clientX, clientY);
    dragOverZoneRef.current = zone;
    setDragOverZone(zone);
    setDragPreviewPosition({ x: clientX, y: clientY });
  }, []);

  const handleTouchDragEnd = useCallback(() => {
    const id = touchDraggingIdRef.current;
    const zone = dragOverZoneRef.current;
    if (id && zone && ZONE_STATUS[zone]) {
      handleStatusChange(id, ZONE_STATUS[zone]);
    }
    touchDraggingIdRef.current = null;
    dragOverZoneRef.current = null;
    touchDragJustEndedRef.current = true;
    setTouchDraggingId(null);
    setDragOverZone(null);
    setDragPreviewPosition(null);
    setTimeout(() => {
      touchDragJustEndedRef.current = false;
    }, 300);
  }, [handleStatusChange]);

  const draggedAppointment = touchDraggingId ? filteredReservations.find((a) => a._id === touchDraggingId) : null;

  const handleViewDetailsUnlessTouchDrag = useCallback(
    (id) => {
      if (touchDragJustEndedRef.current) return;
      handleViewDetails(id);
    },
    [handleViewDetails]
  );

  return (
    <AppLayout>
      <div className="appointments-page">

        {/* Ghost de la card qui suit le doigt pendant le drag tactile */}
        {touchDraggingId && dragPreviewPosition && draggedAppointment && (
          <div
            className="reservation-drag-preview"
            style={{
              left: dragPreviewPosition.x,
              top: dragPreviewPosition.y,
            }}
          >
            <span className="reservation-drag-preview-time">{draggedAppointment.heure}</span>
            <span className="reservation-drag-preview-persons">{draggedAppointment.nombrePersonnes ?? "-"}</span>
            <span className="reservation-drag-preview-name">{getClientFullName(draggedAppointment.client, draggedAppointment)}</span>
          </div>
        )}

        <div className="page-header">
          <div className="header-actions">
            <button
              className="btn-primary"
              onClick={openCreateModal}
            >
              {t('reservations.newButton')}
            </button>
          </div>
        </div>
        
        <AppointmentsFilters
          filters={filters}
          handleFilterChange={handleFilterChange}
          resetFilters={resetFilters}
          hasActiveFilters={hasActiveFilters}
          activeService={activeService}
          setActiveService={setActiveService}
        />


        {/* Messages d'erreur */}
        {error && (
          <div className="notification-toast error-message">
            <i className="bi bi-exclamation-triangle-fill"></i>
            <span className="message-content">{error}</span>
            <button className="close-btn" onClick={clearError}>✕</button>
          </div>
        )}

        {/* KPI Couverts */}
        <div className="reservations-kpi-covers">
          <div className="kpi-covers-item">
            <span className="kpi-covers-label">{t("reservations.coversMax")}</span>
            <span className="kpi-covers-value">{capacity ?? "-"}</span>
          </div>
          <div className="kpi-covers-item">
            <span className="kpi-covers-label">{t("reservations.coversReserved")}</span>
            <span className="kpi-covers-value">{couvertsReserves}</span>
          </div>
          <div className="kpi-covers-item">
            <span className="kpi-covers-label">{t("reservations.coversArrived")}</span>
            <span className="kpi-covers-value">{couvertsArrives}</span>
          </div>
          <div className="kpi-covers-item">
            <span className="kpi-covers-label">{t("reservations.coversRemaining")}</span>
            <span className="kpi-covers-value">{couvertsRestants ?? "-"}</span>
          </div>
        </div>

        {/* Couverts par créneau horaire */}
        {coversPerSlot.length > 0 && (
          <div className="reservations-covers-per-slot">
            <h4 className="covers-per-slot-title">{t("reservations.coversPerSlot")}</h4>
            <div className="covers-per-slot-list">
              {coversPerSlot.map(([heure, count]) => (
                <span key={heure} className="covers-per-slot-item">
                  {heure} <strong>{count}</strong> cov.
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Zone Arrivent dans 15 min (uniquement si date = aujourd'hui) */}
        {isViewingToday && (
          <div className="appointments-zone arriving-soon-zone">
            <h3 className="zone-title">
              <span className="zone-icon"></span>
              {t("reservations.arrivingIn15")}
              <span className="zone-count">{arrivingIn15Min.length}</span>
            </h3>
            {arrivingIn15Min.length === 0 ? (
              <p className="arriving-soon-empty">{t("reservations.noArrivingIn15")}</p>
            ) : (
              <ul className="arriving-soon-list">
                {arrivingIn15Min.map((apt) => (
                  <li
                    key={apt._id}
                    className="arriving-soon-item"
                    onClick={() => handleViewDetails(apt._id)}
                  >
                    <span className="arriving-soon-time">{apt.heure}</span>
                    <span className="arriving-soon-name">{getClientFullName(apt.client, apt)}</span>
                    <span className="arriving-soon-persons">({apt.nombrePersonnes ?? "-"})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="appointments-section">
          {/* Zone des réservations en attente */}
          <div
            className={`appointments-zone waiting-zone ${dragOverZone === "waiting" ? "drag-over" : ""}`}
            data-zone="waiting"
            onDragOver={(e) => handleZoneDragOver(e, "waiting")}
            onDragLeave={(e) => handleZoneDragLeave(e, "waiting")}
            onDrop={(e) => handleZoneDrop(e, "waiting")}
          >
                <h3 className="zone-title">
                  <span className="zone-icon"></span>
                  {t('reservations.waitingReservations')}
                  <span className="zone-count">
                    {filteredReservations.filter(apt => 
                      ['planifie', 'confirme'].includes(apt.statut)
                    ).length}
                  </span>
                </h3>
                <AppointmentsList
                  variant="reservations"
                  enableDragDrop
                  touchDraggingId={touchDraggingId}
                  onLongPressStart={handleLongPressStart}
                  onTouchDragMove={handleTouchDragMove}
                  onTouchDragEnd={handleTouchDragEnd}
                  appointments={filteredReservations.filter(apt => 
                    ['planifie', 'confirme'].includes(apt.statut)
                  )}
                  loading={loading}
                  error={error}
                  pagination={pagination}
                  onViewDetails={handleViewDetailsUnlessTouchDrag}
                  onStatusChange={handleStatusChange}
                  onDelete={(id) => handleDeleteAppointment(id, t)}
                  formatDateTime={formatDateTime}
                  getStatusBadge={(statut) => {
                    const badge = getStatusBadge(statut, t);
                    return <span className={`status-badge ${badge.className}`}>{badge.label}</span>;
                  }}
                />
              </div>

              {/* Zone des clients présents */}
              <div
                className={`appointments-zone in-progress-zone ${dragOverZone === "in-progress" ? "drag-over" : ""}`}
                data-zone="in-progress"
                onDragOver={(e) => handleZoneDragOver(e, "in-progress")}
                onDragLeave={(e) => handleZoneDragLeave(e, "in-progress")}
                onDrop={(e) => handleZoneDrop(e, "in-progress")}
              >
                <h3 className="zone-title">
                  <span className="zone-icon"></span>
                  {t('reservations.inProgressReservations')}
                  <span className="zone-count">
                    {filteredReservations.filter(apt => apt.statut === 'en_cours').length}
                  </span>
                </h3>
                <AppointmentsList
                  variant="reservations"
                  enableDragDrop
                  touchDraggingId={touchDraggingId}
                  onLongPressStart={handleLongPressStart}
                  onTouchDragMove={handleTouchDragMove}
                  onTouchDragEnd={handleTouchDragEnd}
                  appointments={filteredReservations.filter(apt => apt.statut === 'en_cours')}
                  loading={loading}
                  error={error}
                  pagination={pagination}
                  onViewDetails={handleViewDetailsUnlessTouchDrag}
                  onStatusChange={handleStatusChange}
                  onDelete={(id) => handleDeleteAppointment(id, t)}
                  formatDateTime={formatDateTime}
                  getStatusBadge={(statut) => {
                    const badge = getStatusBadge(statut, t);
                    return <span className={`status-badge ${badge.className}`}>{badge.label}</span>;
                  }}
                />
              </div>

              {/* Zone des réservations terminées */}
              <div
                className={`appointments-zone completed-zone ${dragOverZone === "completed" ? "drag-over" : ""}`}
                data-zone="completed"
                onDragOver={(e) => handleZoneDragOver(e, "completed")}
                onDragLeave={(e) => handleZoneDragLeave(e, "completed")}
                onDrop={(e) => handleZoneDrop(e, "completed")}
              >
                <h3 className="zone-title">
                  <span className="zone-icon"></span>
                  {t('reservations.completedReservations')}
                  <span className="zone-count">
                    {filteredReservations.filter(apt => 
                      ['termine', 'annule'].includes(apt.statut)
                    ).length}
                  </span>
                </h3>
                <AppointmentsList
                  variant="reservations"
                  enableDragDrop
                  touchDraggingId={touchDraggingId}
                  onLongPressStart={handleLongPressStart}
                  onTouchDragMove={handleTouchDragMove}
                  onTouchDragEnd={handleTouchDragEnd}
                  appointments={filteredReservations.filter(apt => 
                    ['termine', 'annule'].includes(apt.statut)
                  )}
                  loading={loading}
                  error={error}
                  pagination={pagination}
                  onViewDetails={handleViewDetailsUnlessTouchDrag}
                  onStatusChange={handleStatusChange}
                  onDelete={(id) => handleDeleteAppointment(id, t)}
                  formatDateTime={formatDateTime}
                  getStatusBadge={(statut) => {
                    const badge = getStatusBadge(statut, t);
                    return <span className={`status-badge ${badge.className}`}>{badge.label}</span>;
                  }}
                />
              </div>
        </div>

        {/* Modal de création de réservation */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={closeCreateModal}>
            <div className="modal-content create-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-body">
                <CreateAppointmentForm
                  onSubmit={handleCreateAppointment}
                  onCancel={closeCreateModal}
                  loading={loading}
                  appointmentType="Réservation de table"
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal de détails de réservation */}
        {showModal && selectedAppointment && (
          <div className="modal-overlay" onClick={closeDetailsModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-body">
                <AppointmentDetails
                  appointment={selectedAppointment}
                  onEdit={handleEditAppointment}
                  onStatusChange={handleStatusChange}
                  onDelete={(id) => handleDeleteAppointment(id, t)}
                  onClose={closeDetailsModal}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default ReservationsPage;

