import { useState } from "react";
import { fetchCall, updateCallStatus } from "../../API/Calls/api";
import { updateClient } from "../../API/Clients/api"
import { useNotifications } from "../Notification/useNotifications";

export function useCallModal() {
  const { notifySuccess, notifyError } = useNotifications();
  
  const [selectedCall, setSelectedCall] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isEditingInDetailModal, setIsEditingInDetailModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [updating, setUpdating] = useState(false);

  const openModal = async (callId) => {
    try {
      const callData = await fetchCall(callId);
      setSelectedCall(callData.data);
      setShowDetailModal(true);
    } catch (err) {
      notifyError("Erreur lors du chargement des détails");
    }
  };

  const closeModal = () => {
    setShowDetailModal(false);
    setIsEditingInDetailModal(false);
    setEditFormData({});
    setSelectedCall(null);
  };

  const startEditing = () => {
    if (selectedCall) {
      setEditFormData({
        prenom: selectedCall.client?.prenom || "",
        nom: selectedCall.client?.nom || "",
        telephone: selectedCall.client?.telephone || "",
        email: selectedCall.client?.email || "",
        adresse: selectedCall.client?.adresse || "",
        type_demande: selectedCall.type_demande || "",
        description: selectedCall.description || "",
        statut: selectedCall.statut || "",
      });
      setIsEditingInDetailModal(true);
    }
  };

  const cancelEditing = () => {
    setIsEditingInDetailModal(false);
    setEditFormData({});
  };

  const saveChanges = async (onSuccess) => {
    if (!selectedCall) return;

    setUpdating(true);
    try {
      // Mettre à jour les infos client
      await updateClient(selectedCall._id, {
        prenom: editFormData.prenom,
        nom: editFormData.nom,
        telephone: editFormData.telephone,
        email: editFormData.email,
        adresse: editFormData.adresse,
      });

      // Mettre à jour le statut si changé
      if (editFormData.statut !== selectedCall.statut) {
        await updateCallStatus(selectedCall._id, editFormData.statut);
      }

      // Recharger les données de l'appel
      const updatedCallData = await fetchCall(selectedCall._id);
      setSelectedCall(updatedCallData.data);

      // Sortir du mode édition
      setIsEditingInDetailModal(false);
      setEditFormData({});

      notifySuccess("Appel modifié avec succès");
      
      // Callback pour recharger la liste
      if (onSuccess) onSuccess();
    } catch (err) {
      notifyError("Erreur lors de la modification");
      throw err;
    } finally {
      setUpdating(false);
    }
  };

  return {
    // États
    selectedCall,
    showDetailModal,
    isEditingInDetailModal,
    editFormData,
    updating,
    
    // Setters
    setEditFormData,
    
    // Actions
    openModal,
    closeModal,
    startEditing,
    cancelEditing,
    saveChanges,
  };
}
