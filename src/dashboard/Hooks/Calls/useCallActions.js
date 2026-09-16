import { useState } from "react";
import { deleteCall } from "../../API/Calls/api";
import { useNotifications } from "../Notification/useNotifications";

export function useCallActions() {
  const { notifySuccess, notifyError } = useNotifications();
  
  const [deleting, setDeleting] = useState(null);
  const [deletingPage, setDeletingPage] = useState(false);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (statut) => {
    const statusConfig = {
      nouveau: { emoji: "🆕", text: "Nouveau", class: "status-new" },
      en_cours: { emoji: "⌛", text: "En cours", class: "status-progress" },
      termine: { emoji: "☑️", text: "Terminé", class: "status-completed" },
      annule: { emoji: "❌", text: "Annulé", class: "status-cancelled" },
    };

    const config = statusConfig[statut] || {
      emoji: "📞",
      text: statut,
      class: "status-default",
    };

    return config;
  };

  const handleDeleteCall = async (callId, onSuccess) => {
    if (
      !window.confirm(
        "Êtes-vous sûr de vouloir supprimer cet appel ? Cette action est irréversible."
      )
    ) {
      return;
    }

    setDeleting(callId);
    try {
      await deleteCall(callId);
      notifySuccess("Appel supprimé avec succès");
      
      // Callback pour recharger la liste
      if (onSuccess) onSuccess();
    } catch (err) {
      notifyError("Erreur lors de la suppression");
      throw err;
    } finally {
      setDeleting(null);
    }
  };

  const handleDeletePage = async (calls, onSuccess) => {
    if (calls.length === 0) {
      notifyError("Aucun appel à supprimer sur cette page");
      return;
    }

    const confirmMessage = `Êtes-vous sûr de vouloir supprimer TOUS les ${calls.length} appels de cette page ? Cette action est irréversible.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeletingPage(true);
    try {
      // Supprimer tous les appels de la page courante
      const deletePromises = calls.map((call) => deleteCall(call._id));
      await Promise.all(deletePromises);

      notifySuccess(`${calls.length} appels supprimés avec succès`);
      
      // Callback pour recharger la liste
      if (onSuccess) onSuccess();
    } catch (err) {
      notifyError("Erreur lors de la suppression en lot");
      throw err;
    } finally {
      setDeletingPage(false);
    }
  };

  const handleExportCalls = (calls) => {
    if (calls.length === 0) {
      notifyError("Aucun appel à exporter");
      return;
    }

    try {
      // Préparer les données CSV
      const csvHeaders = [
        "Date",
        "Client",
        "Téléphone",
        "Email",
        "Type de demande",
        "Description",
        "Statut",
      ];

      const csvData = calls.map((call) => [
        formatDate(call.date),
        `${call.client?.prenom || ""} ${call.client?.nom || ""}`.trim() ||
          "Non renseigné",
        call.client?.telephone || "Non renseigné",
        call.client?.email || "Non renseigné",
        call.type_demande || "Non renseigné",
        call.description || "Non renseigné",
        call.statut || "Non renseigné",
      ]);

      // Créer le contenu CSV
      const csvContent = [
        csvHeaders.join(","),
        ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      // Créer et télécharger le fichier
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `appels_${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      notifySuccess("Export réalisé avec succès");
    } catch (err) {
      notifyError("Erreur lors de l'export");
    }
  };

  return {
    // États
    deleting,
    deletingPage,
    
    // Actions
    handleDeleteCall,
    handleDeletePage,
    handleExportCalls,
    
    // Utilitaires
    formatDate,
    getStatusBadge,
  };
}
