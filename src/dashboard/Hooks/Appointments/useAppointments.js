import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchReservations,
  fetchTodayReservations,
  fetchReservation,
  createReservation,
  updateReservation,
  updateReservationStatus,
  deleteReservation,
  checkReservationAvailability,
  fetchReservationAvailableSlots,
  fetchOrders,
  fetchTodayOrders,
  fetchOrder,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  checkOrderAvailability,
} from "../../API/Appointment/api";
import { useAppointmentsFilters } from "./useAppointmentsFilters";
import { useAppointmentsModal } from "./useAppointmentsModal";
import { useWebSocket } from "../../Context/WebSocketContext";

const RESERVATION_TYPE = "Réservation de table";
const ORDER_TYPE = "Commande à emporter";

function resolveServiceFromTime(heure) {
  if (!heure || typeof heure !== "string") return null;
  const match = heure.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const totalMinutes = (h * 60) + m;
  if (totalMinutes >= (11 * 60) && totalMinutes < (15 * 60)) return "midi";
  if (totalMinutes >= (18 * 60) && totalMinutes < (24 * 60)) return "soir";
  return null;
}

async function validateReservationCovers(appointmentData) {
  const date = appointmentData?.date;
  const heure = appointmentData?.heure;
  const requestedCovers = Number(appointmentData?.nombrePersonnes) || 1;

  if (!date || !heure) return;

  const service = resolveServiceFromTime(heure);
  if (!service) return;

  const slotsData = await fetchReservationAvailableSlots(date);
  const remainingCovers =
    service === "midi"
      ? slotsData?.remainingCoversMidi
      : slotsData?.remainingCoversSoir;

  if (remainingCovers == null || !Number.isFinite(remainingCovers)) return;

  if (remainingCovers <= 0) {
    throw new Error(
      service === "soir"
        ? "Le service du soir est complet. Impossible de prendre une réservation."
        : "Le service du midi est complet. Impossible de prendre une réservation."
    );
  }

  if (requestedCovers > remainingCovers) {
    throw new Error(
      `Impossible de réserver ${requestedCovers} couvert(s). Il ne reste que ${remainingCovers} couvert(s) pour ce service.`
    );
  }
}

function normalizeReservation(item) {
  if (!item) return item;
  return { ...item, type: RESERVATION_TYPE, modalite: "Sur place" };
}

function normalizeOrder(item) {
  if (!item) return item;
  return { ...item, type: ORDER_TYPE, modalite: item.modalite || "À emporter" };
}

export function useAppointments(mode = "orders") {
  const isReservations = mode === "reservations";
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Hooks spécialisés
  const filtersHook = useAppointmentsFilters();
  const modalHook = useAppointmentsModal();

  // État principal
  const [appointments, setAppointments] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [currentAppointment, setCurrentAppointment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 50,
    pages: 0,
  });

  // Refs pour stocker les valeurs actuelles sans causer de re-renders
  const paginationRef = useRef(pagination);
  const filtersRef = useRef(filtersHook.filters);
  const loadAppointmentsRef = useRef(null);
  const loadTodayAppointmentsRef = useRef(null);

  // Récupérer tous les rendez-vous avec filtres (réservations ou commandes selon mode)
  const loadAppointments = useCallback(
    async (page = 1, limit = 50, filters = {}) => {
      try {
        setLoading(true);
        setError(null);

        const apiFilters = isReservations
          ? { date: filters.date, statut: filters.statut }
          : { date: filters.date, statut: filters.statut, type: filters.type, modalite: filters.modalite };

        const response = isReservations
          ? await fetchReservations(page, limit, apiFilters)
          : await fetchOrders(page, limit, apiFilters);

        if (response.success) {
          const normalize = isReservations ? normalizeReservation : normalizeOrder;
          const sortedAppointments = response.data.map(normalize).sort((a, b) => {
            const statusOrder = {
              "planifie": 1,
              "confirme": 2,
              "en_cours": 3,
              "termine": 4,
              "annule": 5
            };
            const orderA = statusOrder[a.statut] || 999;
            const orderB = statusOrder[b.statut] || 999;
            return orderA - orderB;
          });
          setAppointments(sortedAppointments);
          setPagination(response.pagination);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [isReservations]
  );

  // Récupérer les rendez-vous du jour
  const loadTodayAppointments = useCallback(async () => {
    try {
      setError(null);
      const response = isReservations
        ? await fetchTodayReservations()
        : await fetchTodayOrders();
      if (response.success) {
        const normalize = isReservations ? normalizeReservation : normalizeOrder;
        setTodayAppointments((response.data || []).map(normalize));
      }
    } catch (err) {
      setError(err.message);
    }
  }, [isReservations]);

  // Récupérer un rendez-vous par ID
  const loadAppointment = useCallback(async (id) => {
    try {
      setLoading(true);
      setError(null);
      const response = isReservations
        ? await fetchReservation(id)
        : await fetchOrder(id);
      if (response.success) {
        const normalize = isReservations ? normalizeReservation : normalizeOrder;
        const data = normalize(response.data);
        setCurrentAppointment(data);
        return data;
      }
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isReservations]);

  // Créer un nouveau rendez-vous ou une commande
  const addAppointment = useCallback(
    async (appointmentData) => {
      try {
        setLoading(true);
        setError(null);

        let response;
        if (isReservations) {
          await validateReservationCovers(appointmentData);
          const payload = {
            nom: appointmentData.nom,
            telephone: appointmentData.telephone,
            date: appointmentData.date,
            heure: appointmentData.heure,
            description: appointmentData.description,
            nombrePersonnes: appointmentData.nombrePersonnes,
            notes_internes: appointmentData.notes_internes,
            statut: appointmentData.statut,
            createdBy: appointmentData.createdBy || "manual",
            related_call: appointmentData.related_call || null,
          };
          response = await createReservation(payload);
        } else {
          const payload = {
            ...appointmentData,
            type: ORDER_TYPE,
            modalite: appointmentData.modalite || "À emporter",
          };
          response = await createOrder(payload);
        }

        if (response.success) {
          const normalize = isReservations ? normalizeReservation : normalizeOrder;
          const data = normalize(response.data);
          await loadAppointments(pagination.page, pagination.limit, filtersRef.current);
          await loadTodayAppointments();
          return data;
        }
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [isReservations, loadAppointments, loadTodayAppointments, pagination.page, pagination.limit]
  );

  // Mettre à jour un rendez-vous ou une commande
  const editAppointment = useCallback(
    async (id, appointmentData) => {
      try {
        setLoading(true);
        setError(null);

        let response;
        if (isReservations) {
          await validateReservationCovers(appointmentData);
          const payload = {
            nom: appointmentData.nom,
            telephone: appointmentData.telephone,
            date: appointmentData.date,
            heure: appointmentData.heure,
            description: appointmentData.description,
            nombrePersonnes: appointmentData.nombrePersonnes,
            notes_internes: appointmentData.notes_internes,
            statut: appointmentData.statut,
          };
          response = await updateReservation(id, payload);
        } else {
          response = await updateOrder(id, {
            ...appointmentData,
            type: appointmentData.type || ORDER_TYPE,
            modalite: appointmentData.modalite || "À emporter",
          });
        }

        if (response.success) {
          const normalize = isReservations ? normalizeReservation : normalizeOrder;
          const data = normalize(response.data);
          setAppointments((prev) =>
            prev.map((apt) => (apt._id === id ? data : apt))
          );
          setTodayAppointments((prev) =>
            prev.map((apt) => (apt._id === id ? data : apt))
          );
          if (currentAppointment && currentAppointment._id === id) {
            setCurrentAppointment(data);
          }
          return data;
        }
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [isReservations, currentAppointment]
  );

  // Mettre à jour le statut
  const changeAppointmentStatus = useCallback(
    async (id, statut) => {
      try {
        setError(null);
        const response = isReservations
          ? await updateReservationStatus(id, statut)
          : await updateOrderStatus(id, statut);
        if (response.success) {
          setAppointments((prev) =>
            prev.map((apt) => (apt._id === id ? { ...apt, statut } : apt))
          );
          setTodayAppointments((prev) =>
            prev.map((apt) => (apt._id === id ? { ...apt, statut } : apt))
          );
          if (currentAppointment && currentAppointment._id === id) {
            setCurrentAppointment((prev) => ({ ...prev, statut }));
          }
          return response.data;
        }
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [isReservations, currentAppointment]
  );

  // Supprimer un rendez-vous ou une commande
  const removeAppointment = useCallback(
    async (id) => {
      try {
        setLoading(true);
        setError(null);
        const response = isReservations
          ? await deleteReservation(id)
          : await deleteOrder(id);
        if (response.success) {
          setAppointments((prev) => prev.filter((apt) => apt._id !== id));
          setTodayAppointments((prev) => prev.filter((apt) => apt._id !== id));
          if (currentAppointment && currentAppointment._id === id) {
            setCurrentAppointment(null);
          }
          return true;
        }
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [isReservations, currentAppointment]
  );

  // Vérifier la disponibilité d'un créneau
  const verifyAvailability = useCallback(async (date, heure, duree) => {
    try {
      setError(null);
      const response = isReservations
        ? await checkReservationAvailability(date, heure, duree)
        : await checkOrderAvailability(date, heure, duree);
      if (response.success) {
        return {
          available: response.available,
          conflicts: response.conflicts,
        };
      }
      return { available: false, conflicts: 0 };
    } catch (err) {
      setError(err.message);
      return { available: false, conflicts: 0 };
    }
  }, [isReservations]);

  // Charger les rendez-vous du jour au montage du composant
  useEffect(() => {
    loadTodayAppointments();
  }, [loadTodayAppointments]);

  // Mettre à jour les refs
  useEffect(() => {
    paginationRef.current = pagination;
    filtersRef.current = filtersHook.filters;
    loadAppointmentsRef.current = loadAppointments;
    loadTodayAppointmentsRef.current = loadTodayAppointments;
  }, [pagination, filtersHook.filters, loadAppointments, loadTodayAppointments]);

  // Callback pour rafraîchir quand une nouvelle commande arrive via WebSocket
const handleNewOrder = useCallback((notificationData) => {
    if (loadAppointmentsRef.current) {
      loadAppointmentsRef.current(paginationRef.current.page, paginationRef.current.limit, filtersRef.current);
    }
    if (loadTodayAppointmentsRef.current) {
      loadTodayAppointmentsRef.current();
    }
  }, []);

  // Connecter au WebSocket centralisé
  const { isConnected, subscribe, lastOrderNotificationAt } = useWebSocket();
  const lastRefetchedForNotifRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribe("order", handleNewOrder);
    return () => unsubscribe();
  }, [subscribe, handleNewOrder]);

  // Refetch quand une notif commande/resa arrive (meme si on n'etait pas sur la page au moment de la notif)
  useEffect(() => {
    if (lastOrderNotificationAt == null || lastOrderNotificationAt === lastRefetchedForNotifRef.current) return;
    lastRefetchedForNotifRef.current = lastOrderNotificationAt;
    const t = setTimeout(() => {
      if (loadAppointmentsRef.current) {
        loadAppointmentsRef.current(paginationRef.current.page, paginationRef.current.limit, filtersRef.current);
      }
      if (loadTodayAppointmentsRef.current) {
        loadTodayAppointmentsRef.current();
      }
    }, 0);
    return () => clearTimeout(t);
  }, [lastOrderNotificationAt]);

  // Fonctions utilitaires
  const getAppointmentsByStatus = useCallback(
    (statut) => {
      return appointments.filter((apt) => apt.statut === statut);
    },
    [appointments]
  );

  const getTodayAppointmentsByStatus = useCallback(
    (statut) => {
      return todayAppointments.filter((apt) => apt.statut === statut);
    },
    [todayAppointments]
  );

  const getUpcomingAppointments = useCallback(() => {
    const now = new Date();
    return todayAppointments.filter((apt) => {
      const [hours, minutes] = apt.heure.split(":").map(Number);
      const appointmentTime = new Date();
      appointmentTime.setHours(hours, minutes, 0, 0);
      return appointmentTime > now && apt.statut !== "annule";
    });
  }, [todayAppointments]);

  // Charger les rendez-vous au montage et quand les filtres changent
  useEffect(() => {
    const filterParams = {};
    if (filtersHook.filters.date) filterParams.date = filtersHook.filters.date;
    if (filtersHook.filters.type) filterParams.type = filtersHook.filters.type;
    if (filtersHook.filters.modalite) filterParams.modalite = filtersHook.filters.modalite;
    
    loadAppointments(1, 50, filterParams);
  }, [loadAppointments, filtersHook.filters]);

  // Détecter l'orderId dans l'URL et ouvrir la modale détail (ex. clic sur une notif commande/resa)
  const hasTriedRefetchForOrderIdRef = useRef(false);
  useEffect(() => {
    const orderId = searchParams.get("orderid");
    if (!orderId) {
      hasTriedRefetchForOrderIdRef.current = false;
      return;
    }
    if (modalHook.showModal) return;

    const appointment = appointments.find((a) => a._id === orderId);
    if (appointment) {
      modalHook.openDetailsModal(appointment);
      setSearchParams({});
      hasTriedRefetchForOrderIdRef.current = false;
      return;
    }

    if (appointments.length > 0 && !hasTriedRefetchForOrderIdRef.current) {
      hasTriedRefetchForOrderIdRef.current = true;
      loadAppointments(1, 50, filtersHook.filters);
    }
  }, [searchParams, appointments, modalHook, setSearchParams, loadAppointments, filtersHook.filters]);

  // Wrappers pour les actions avec confirmation
  const handleStatusChange = useCallback(async (appointmentId, newStatus) => {
    try {
      await changeAppointmentStatus(appointmentId, newStatus);
    } catch (error) {
    }
  }, [changeAppointmentStatus]);

  const handleDeleteAppointment = useCallback(async (appointmentId, t) => {
    if (window.confirm(t ? t('appointments.confirmDelete') : 'Confirmer la suppression ?')) {
      try {
        await removeAppointment(appointmentId);
        modalHook.closeDetailsModal();
      } catch (error) {
      }
    }
  }, [removeAppointment, modalHook]);

  const handleCreateAppointment = useCallback(async (appointmentData) => {
    try {
      await addAppointment(appointmentData);
      modalHook.closeCreateModal();
      // Recharger les rendez-vous
      const filterParams = {};
      if (filtersHook.filters.date) filterParams.date = filtersHook.filters.date;
      if (filtersHook.filters.type) filterParams.type = filtersHook.filters.type;
      if (filtersHook.filters.modalite) filterParams.modalite = filtersHook.filters.modalite;
      loadAppointments(1, 50, filterParams);
    } catch (error) {
    }
  }, [addAppointment, modalHook, filtersHook.filters, loadAppointments]);

  const handleEditAppointment = useCallback(async (appointmentId, appointmentData) => {
    try {
      await editAppointment(appointmentId, appointmentData);
      modalHook.closeDetailsModal();
      // Recharger les rendez-vous
      const filterParams = {};
      if (filtersHook.filters.date) filterParams.date = filtersHook.filters.date;
      if (filtersHook.filters.type) filterParams.type = filtersHook.filters.type;
      if (filtersHook.filters.modalite) filterParams.modalite = filtersHook.filters.modalite;
      loadAppointments(1, 50, filterParams);
    } catch (error) {
    }
  }, [editAppointment, modalHook, filtersHook.filters, loadAppointments]);

  // Utilitaires de formatage
  const formatDateTime = useCallback((dateString, type = "full") => {
    const date = new Date(dateString);
    if (type === "date") {
      return date.toLocaleDateString("fr-FR");
    }
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const getStatusBadge = useCallback((statut, t) => {
    const statusConfig = {
      planifie: { label: t ? t('appointments.statuses.planifie') : 'Planifié', class: "status-planifie" },
      confirme: { label: t ? t('appointments.statuses.confirme') : 'Confirmé', class: "status-confirme" },
      en_cours: { label: t ? t('appointments.statuses.en_cours') : 'En cours', class: "status-en-cours" },
      termine: { label: t ? t('appointments.statuses.termine') : 'Terminé', class: "status-termine" },
      annule: { label: t ? t('appointments.statuses.annule') : 'Annulé', class: "status-annule" },
    };

    const config = statusConfig[statut] || {
      label: statut,
      class: "status-default",
    };

    return {
      label: config.label,
      className: config.class
    };
  }, []);

  return {
    // États principaux
    appointments,
    todayAppointments,
    currentAppointment,
    loading,
    error,
    pagination,
    isConnected,

    // Filtres
    filters: filtersHook.filters,
    handleFilterChange: filtersHook.handleFilterChange,
    resetFilters: filtersHook.resetFilters,
    hasActiveFilters: filtersHook.hasActiveFilters,

    // Modals
    showModal: modalHook.showModal,
    showCreateModal: modalHook.showCreateModal,
    selectedAppointment: modalHook.selectedAppointment,
    openDetailsModal: modalHook.openDetailsModal,
    closeDetailsModal: modalHook.closeDetailsModal,
    openCreateModal: modalHook.openCreateModal,
    closeCreateModal: modalHook.closeCreateModal,
    closeAllModals: modalHook.closeAllModals,
    handleViewDetails: (appointmentId) => modalHook.handleViewDetails(loadAppointment, appointmentId),

    // Actions
    loadAppointments,
    loadTodayAppointments,
    loadAppointment,
    addAppointment,
    editAppointment,
    changeAppointmentStatus,
    removeAppointment,
    verifyAvailability,

    // Utilitaires
    getAppointmentsByStatus,
    getTodayAppointmentsByStatus,
    getUpcomingAppointments,
    formatDateTime,
    getStatusBadge,

    // Wrappers d'actions
    handleStatusChange,
    handleDeleteAppointment,
    handleCreateAppointment,
    handleEditAppointment,

    // Reset
    clearError: () => setError(null),
    clearCurrentAppointment: () => setCurrentAppointment(null),
  };
}
