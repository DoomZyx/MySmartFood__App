import { useState } from "react";
import { createCall } from "../../API/Calls/api";

export function useCreateCall() {
  // État du formulaire
  const [formData, setFormData] = useState({
    nom: "",
    telephone: "",
    email: "",
    adresse: "",
    entrepriseName: "",
    type_demande: "",
    services: "",
    description: "",
    statut: "nouveau",
  });

  // États de l'UI
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Constantes pour les options du formulaire
  const typesDemande = [
    "Commande à emporter",
    "Livraison à domicile",
    "Réservation de table",
    "Information menu",
    "Réclamation",
    "Facturation",
    "Autre",
  ];

  const servicesOptions = [
    "Pizzas",
    "Burgers",
    "Salades",
    "Boissons",
    "Desserts",
    "Menus",
    "Promotions",
    "Autre",
  ];

  /**
   * Gérer les changements d'input
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /**
   * Soumettre le formulaire
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation basique
    if (
      !formData.prenom ||
      !formData.nom ||
      !formData.telephone ||
      !formData.type_demande
    ) {
      setError("Veuillez remplir tous les champs obligatoires");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const callData = {
        ...formData,
        date: new Date().toISOString(),
      };

      await createCall(callData);

      setSuccess(true);
      
      // Réinitialiser le formulaire
      setFormData({
        nom: "",
        telephone: "",
        email: "",
        adresse: "",
        entrepriseName: "",
        type_demande: "",
        services: "",
        description: "",
        statut: "nouveau",
      });

      // Cacher le message de succès après 5 secondes
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Réinitialiser le formulaire
   */
  const handleReset = () => {
    setFormData({
      nom: "",
      telephone: "",
      email: "",
      adresse: "",
      entrepriseName: "",
      type_demande: "",
      services: "",
      description: "",
      statut: "nouveau",
    });
    setError(null);
    setSuccess(false);
  };

  return {
    // États
    formData,
    loading,
    success,
    error,
    
    // Constantes
    typesDemande,
    servicesOptions,
    
    // Setters
    setFormData,
    setError,
    
    // Actions
    handleInputChange,
    handleSubmit,
    handleReset,
  };
}




