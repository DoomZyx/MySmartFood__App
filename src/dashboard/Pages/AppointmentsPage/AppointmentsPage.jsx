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
import "./AppointmentsPage.scss";

const DRAG_TYPE = "application/x-smartcrm-reservation";
const ZONE_STATUS = {
  waiting: "confirme",
  "in-progress": "en_cours",
  completed: "termine",
};

function getOrderTotal(appointment) {
  if (!appointment?.commandes?.length) return null;
  const total = appointment.commandes.reduce(
    (sum, item) => sum + (item.prixUnitaire || 0) * (item.quantite || 1),
    0
  );
  return total > 0 ? `${total.toFixed(2)} €` : null;
}

function AppointmentsPage() {
  const { t } = useTranslation();
  const { pricing } = useConfiguration();
  const [activeService, setActiveService] = useState("midi"); // "midi" ou "soir"
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

  // Utiliser le hook qui contient toute la logique
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
  } = useAppointments("orders");

  // Fonction pour déterminer si une heure appartient au service midi ou soir
  const getServiceFromTime = (time) => {
    if (!time) return null;
    const hour = parseInt(time.split(':')[0]);
    // Midi: 11h00 - 15h00, Soir: 18h00 - 23h00
    if (hour >= 11 && hour < 15) return "midi";
    if (hour >= 18 && hour < 24) return "soir";
    return null;
  };

  // Filtrer par service (midi/soir) : les données viennent déjà de l'API commandes
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const service = getServiceFromTime(apt.heure);
      return service === activeService;
    });
  }, [appointments, activeService]);

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

  const draggedOrder = touchDraggingId ? filteredAppointments.find((a) => a._id === touchDraggingId) : null;

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

        {/* Ghost de la card pendant le drag tactile (commandes) */}
        {touchDraggingId && dragPreviewPosition && draggedOrder && (
          <div
            className="reservation-drag-preview"
            style={{
              left: dragPreviewPosition.x,
              top: dragPreviewPosition.y,
            }}
          >
            <span className="reservation-drag-preview-time">{draggedOrder.heure}</span>
            <span className="reservation-drag-preview-amount">{getOrderTotal(draggedOrder) ?? "-"}</span>
            <span className="reservation-drag-preview-name">{getClientFullName(draggedOrder.client, draggedOrder)}</span>
          </div>
        )}

        <div className="page-header">
          <div className="header-actions">
            <button
              className="btn-primary"
              onClick={openCreateModal}
            >
              {t('appointments.newButton')}
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

        <div className="appointments-section">
              {/* Zone des commandes en attente */}
              <div
                className={`appointments-zone waiting-zone ${dragOverZone === "waiting" ? "drag-over" : ""}`}
                data-zone="waiting"
                onDragOver={(e) => handleZoneDragOver(e, "waiting")}
                onDragLeave={(e) => handleZoneDragLeave(e, "waiting")}
                onDrop={(e) => handleZoneDrop(e, "waiting")}
              >
                <h3 className="zone-title">
                  <span className="zone-icon"></span>
                  {t('appointments.waitingOrders')}
                  <span className="zone-count">
                    {filteredAppointments.filter(apt => 
                      ['planifie', 'confirme'].includes(apt.statut)
                    ).length}
                  </span>
                </h3>
                <AppointmentsList
                  variant="orders"
                  enableDragDrop
                  touchDraggingId={touchDraggingId}
                  onLongPressStart={handleLongPressStart}
                  onTouchDragMove={handleTouchDragMove}
                  onTouchDragEnd={handleTouchDragEnd}
                  appointments={filteredAppointments.filter(apt => 
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

              {/* Zone des commandes en cours de préparation */}
              <div
                className={`appointments-zone in-progress-zone ${dragOverZone === "in-progress" ? "drag-over" : ""}`}
                data-zone="in-progress"
                onDragOver={(e) => handleZoneDragOver(e, "in-progress")}
                onDragLeave={(e) => handleZoneDragLeave(e, "in-progress")}
                onDrop={(e) => handleZoneDrop(e, "in-progress")}
              >
                <h3 className="zone-title">
                  <span className="zone-icon"></span>
                  {t('appointments.inProgressOrders')}
                  <span className="zone-count">
                    {filteredAppointments.filter(apt => apt.statut === 'en_cours').length}
                  </span>
                </h3>
                <AppointmentsList
                  variant="orders"
                  enableDragDrop
                  touchDraggingId={touchDraggingId}
                  onLongPressStart={handleLongPressStart}
                  onTouchDragMove={handleTouchDragMove}
                  onTouchDragEnd={handleTouchDragEnd}
                  appointments={filteredAppointments.filter(apt => apt.statut === 'en_cours')}
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

              {/* Zone des commandes terminées */}
              <div
                className={`appointments-zone completed-zone ${dragOverZone === "completed" ? "drag-over" : ""}`}
                data-zone="completed"
                onDragOver={(e) => handleZoneDragOver(e, "completed")}
                onDragLeave={(e) => handleZoneDragLeave(e, "completed")}
                onDrop={(e) => handleZoneDrop(e, "completed")}
              >
                <h3 className="zone-title">
                  <span className="zone-icon"></span>
                  {t('appointments.completedOrders')}
                  <span className="zone-count">
                    {filteredAppointments.filter(apt => 
                      ['termine', 'annule'].includes(apt.statut)
                    ).length}
                  </span>
                </h3>
                <AppointmentsList
                  variant="orders"
                  enableDragDrop
                  touchDraggingId={touchDraggingId}
                  onLongPressStart={handleLongPressStart}
                  onTouchDragMove={handleTouchDragMove}
                  onTouchDragEnd={handleTouchDragEnd}
                  appointments={filteredAppointments.filter(apt => 
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

        {/* Modal de création de rendez-vous */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={closeCreateModal}>
            <div className="modal-content create-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-body">
                <CreateAppointmentForm
                  onSubmit={handleCreateAppointment}
                  onCancel={closeCreateModal}
                  loading={loading}
                  appointmentType="Commande à emporter"
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal de détails de rendez-vous */}
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

export default AppointmentsPage;

