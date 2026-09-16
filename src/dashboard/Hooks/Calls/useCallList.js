import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchCalls } from "../../API/Calls/api";
import { useCallFilters } from "./useCallFilters";
import { useCallModal } from "./useCallModal";
import { usePagination } from "../Pagination/usePagination";
import { useCallActions } from "./useCallActions";
import { useWebSocket } from "../../Context/WebSocketContext";

export function useCallList() {
 const [searchParams, setSearchParams] = useSearchParams();
 
 // Hooks spécialisés
 const { filters, handleFilterChange } = useCallFilters();
 const modalHook = useCallModal();
 const paginationHook = usePagination();
 const actionsHook = useCallActions();

 // État principal
 const [calls, setCalls] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);

 // Refs pour stocker les valeurs actuelles sans causer de re-renders
 const filtersRef = useRef(filters);
 const paginationRef = useRef(paginationHook.currentPage);
 const loadCallsRef = useRef(null);


 // Fonction principale de chargement des appels
 const loadCalls = async (page = 1, appliedFilters = filters) => {
   try {
     setLoading(true);
     setError(null);

     const filterParams = {};
     if (appliedFilters.date) filterParams.date = appliedFilters.date;
     if (appliedFilters.search) filterParams.nom = appliedFilters.search;
     if (appliedFilters.status) filterParams.statut = appliedFilters.status;

     const response = await fetchCalls(page, 20, filterParams);

     if (response.success) {
       setCalls(response.data || []);
       const newPage = paginationHook.updatePagination(response.total, 20);
       if (newPage !== page) {
         // Si la page a changé (ex: suppression), recharger avec la bonne page
         return loadCalls(newPage, appliedFilters);
       }
     } else {
       throw new Error("Erreur lors du chargement des appels");
     }
   } catch (err) {
     setError(err.message);
   } finally {
     setLoading(false);
   }
 };

 // Wrapper pour les changements de filtres
 const handleFilterChangeWithReload = (key, value) => {
   const newFilters = handleFilterChange(key, value);
   paginationHook.goToFirstPage();
   loadCalls(1, newFilters);
 };

 useEffect(() => {
   loadCalls(1, filters);
 }, []);

 // Gérer l'ouverture automatique de la modal depuis les paramètres URL
 useEffect(() => {
   const viewCallId = searchParams.get("viewCall");
   if (viewCallId) {
     modalHook.openModal(viewCallId);
     // Nettoyer le paramètre URL après l'ouverture
     setSearchParams({});
   }
 }, [searchParams]);

 // Wrapper pour les changements de page
 const handlePageChange = (page) => {
   paginationHook.goToPage(page);
   loadCalls(page, filters);
 };

 // Mettre à jour les refs
 useEffect(() => {
   filtersRef.current = filters;
   paginationRef.current = paginationHook.currentPage;
   loadCallsRef.current = loadCalls;
 }, [filters, paginationHook.currentPage, loadCalls]);

 // Callback pour rafraîchir quand un nouvel appel arrive via WebSocket
 const handleNewCall = useCallback((notificationData) => {
   if (loadCallsRef.current) {
     loadCallsRef.current(paginationRef.current, filtersRef.current);
   }
 }, []);

 // Connecter au WebSocket centralisé
 const { isConnected, subscribe } = useWebSocket();
 
 useEffect(() => {
   const unsubscribe = subscribe("call", handleNewCall);
   return () => unsubscribe();
 }, [subscribe, handleNewCall]);

 // Wrappers pour les actions avec rechargement
 const handleDeleteCallWithReload = async (callId) => {
   await actionsHook.handleDeleteCall(callId, () => {
     loadCalls(paginationHook.currentPage, filters);
   });
 };

 const handleDeletePageWithReload = async (calls) => {
   await actionsHook.handleDeletePage(calls, () => {
     loadCalls(paginationHook.currentPage, filters);
   });
 };

 const handleSaveModalWithReload = async () => {
   await modalHook.saveChanges(() => {
     loadCalls(paginationHook.currentPage, filters);
   });
 };


 return {
  // États principaux
  calls,
  loading,
  error,
  
  // WebSocket
  isConnected,
  
  // Filtres
  filters,
  handleFilterChange: handleFilterChangeWithReload,
  
  // Pagination
  currentPage: paginationHook.currentPage,
  totalPages: paginationHook.totalPages,
  handlePageChange,
  
  // Modal
  ...modalHook,
  handleSaveFromDetailModal: handleSaveModalWithReload,
  
  // Actions
  handleDeleteCall: handleDeleteCallWithReload,
  handleDeletePage: handleDeletePageWithReload,
  handleExportCalls: actionsHook.handleExportCalls,
  
  // Utilitaires
  formatDate: actionsHook.formatDate,
  getStatusBadge: actionsHook.getStatusBadge,
  
  // Actions de base
  loadCalls,
 }
}