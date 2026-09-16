import { useState } from "react";

export function useAppointmentsModal() {
  const [showModal, setShowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  // Modal de détails/modification
  const openDetailsModal = (appointment) => {
    setSelectedAppointment(appointment);
    setShowModal(true);
  };

  const closeDetailsModal = () => {
    setShowModal(false);
    setSelectedAppointment(null);
  };

  // Modal de création
  const openCreateModal = () => {
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
  };

  // Fermer toutes les modals
  const closeAllModals = () => {
    setShowModal(false);
    setShowCreateModal(false);
    setSelectedAppointment(null);
  };

  // Gérer l'ouverture des détails d'un rendez-vous
  const handleViewDetails = async (loadAppointmentFn, appointmentId) => {
    try {
      const appointment = await loadAppointmentFn(appointmentId);
      if (appointment) {
        openDetailsModal(appointment);
      }
    } catch (error) {
    }
  };

  return {
    // États
    showModal,
    showCreateModal,
    selectedAppointment,
    
    // Actions pour modal de détails
    openDetailsModal,
    closeDetailsModal,
    
    // Actions pour modal de création
    openCreateModal,
    closeCreateModal,
    
    // Actions générales
    closeAllModals,
    handleViewDetails,
  };
}
