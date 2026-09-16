import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { fetchPricing, updatePricing, addProduct, updateProduct, deleteProduct } from "../../API/Pricing/api";

export function useConfiguration() {
  const { i18n } = useTranslation();
  
  // États
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("restaurant");
  const [editingProduct, setEditingProduct] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [languageSuccess, setLanguageSuccess] = useState(false);
  const [newProduct, setNewProduct] = useState({
    nom: "",
    description: "",
    prixBase: 0,
    disponible: true,
    options: {}, // Options personnalisables (viandes, sauces, etc.)
    composition: { // Pour les menus
      platPrincipal: null // { categorie, produitId }
      // Frites et boisson toujours incluses automatiquement
    }
  });

  // Valeurs par défaut pour les horaires
  const defaultHoraires = {
    lundi: { 
      ouvert: false, 
      midi: { ouverture: "12:00", fermeture: "14:00" },
      soir: { ouverture: "19:00", fermeture: "22:00" }
    },
    mardi: { 
      ouvert: true, 
      midi: { ouverture: "12:00", fermeture: "14:00" },
      soir: { ouverture: "19:00", fermeture: "22:00" }
    },
    mercredi: { 
      ouvert: true, 
      midi: { ouverture: "12:00", fermeture: "14:00" },
      soir: { ouverture: "19:00", fermeture: "22:00" }
    },
    jeudi: { 
      ouvert: true, 
      midi: { ouverture: "12:00", fermeture: "14:00" },
      soir: { ouverture: "19:00", fermeture: "22:00" }
    },
    vendredi: { 
      ouvert: true, 
      midi: { ouverture: "12:00", fermeture: "14:00" },
      soir: { ouverture: "19:00", fermeture: "22:00" }
    },
    samedi: { 
      ouvert: true, 
      midi: { ouverture: "12:00", fermeture: "14:00" },
      soir: { ouverture: "19:00", fermeture: "22:00" }
    },
    dimanche: { 
      ouvert: false, 
      midi: { ouverture: "12:00", fermeture: "14:00" },
      soir: { ouverture: "19:00", fermeture: "22:00" }
    }
  };

  // Charger la configuration au montage
  useEffect(() => {
    loadPricing();
  }, []);

  /**
   * Charger les données de pricing
   * @param {boolean} silent - Si true, ne pas afficher l'écran de chargement (préserve le scroll après add/update)
   */
  const loadPricing = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const response = await fetchPricing();
      
      if (response.success) {
        const data = response.data || {};
        
        // Fusionner les horaires en conservant les données du backend
        const horaires = data.restaurantInfo?.horairesOuverture || defaultHoraires;
        
        // Construire l'objet final en GARDANT les données du backend
        const initializedData = {
          instancePhoneNumber: data.instancePhoneNumber || null,
          restaurantInfo: {
            nom: data.restaurantInfo?.nom || "",
            adresse: data.restaurantInfo?.adresse || "",
            telephone: data.restaurantInfo?.telephone || "",
            email: data.restaurantInfo?.email || "",
            nombreCouverts: data.restaurantInfo?.nombreCouverts || 0,
            accessibilitePmr: data.restaurantInfo?.accessibilitePmr ?? null,
            nombreChaisesBebe: data.restaurantInfo?.nombreChaisesBebe ?? "",
            horairesOuverture: horaires
          },
          menuPricing: data.menuPricing || {
            pizzas: { nom: "Pizzas", produits: [] },
            burgers: { nom: "Burgers", produits: [] },
            salades: { nom: "Salades", produits: [] },
            boissons: { nom: "Boissons", produits: [] },
            desserts: { nom: "Desserts", produits: [] }
          },
          deliveryPricing: {
            activerLivraison: data.deliveryPricing?.activerLivraison ?? true,
            fraisBase: data.deliveryPricing?.fraisBase || 0,
            prixParKm: data.deliveryPricing?.prixParKm || 0,
            distanceMaximale: data.deliveryPricing?.distanceMaximale || 0,
            montantMinimumCommande: data.deliveryPricing?.montantMinimumCommande || 0,
            delaiPreparation: data.deliveryPricing?.delaiPreparation || 30
          }
        };

        setPricing(initializedData);
      } else {
        setError(response.error || "Erreur lors du chargement");
      }
    } catch (err) {
      setError("Impossible de charger la configuration");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  /**
   * Sauvegarder la configuration
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await updatePricing(pricing);
      
      if (response.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(response.error || "Erreur lors de la sauvegarde");
      }
    } catch (err) {
      setError("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Gérer les changements d'input
   */
  const handleInputChange = (path, value) => {
    setPricing(prev => {
      const newPricing = { ...prev };
      const keys = path.split('.');
      let current = newPricing;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newPricing;
    });
  };

  /**
   * Ajouter un produit
   */
  const handleProductAdd = async (categorie) => {
    try {
      setError(null);
      
      if (!newProduct.nom.trim()) {
        setError("Le nom du produit est requis");
        return;
      }

      // Nettoyer les données avant envoi
      const cleanedProduct = { ...newProduct };
      
      // Supprimer options si vide
      if (cleanedProduct.options && Object.keys(cleanedProduct.options).length === 0) {
        delete cleanedProduct.options;
      }
      
      // Supprimer composition si vide ou sans plat principal
      if (cleanedProduct.composition && !cleanedProduct.composition.platPrincipal) {
        delete cleanedProduct.composition;
      }
      
      // Supprimer boissonsDisponibles si vide
      if (cleanedProduct.boissonsDisponibles && cleanedProduct.boissonsDisponibles.length === 0) {
        delete cleanedProduct.boissonsDisponibles;
      }

      const response = await addProduct(categorie, cleanedProduct);
      
      if (response.success) {
        // Recharger les données depuis le serveur pour avoir les IDs corrects (sans écran de chargement pour garder le scroll)
        await loadPricing(true);
        
        setNewProduct({
          nom: "",
          description: "",
          prixBase: 0,
          disponible: true,
          options: {},
          composition: {
            platPrincipal: null
          }
        });
        setShowProductForm(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(response.error || "Erreur lors de l'ajout du produit");
      }
    } catch (err) {
      setError(err.message || "Erreur lors de l'ajout du produit");
    }
  };

  /**
   * Mettre à jour un produit
   */
  const handleProductUpdate = async (categorie, produitId, produitData) => {
    try {
      setError(null);
      const response = await updateProduct(categorie, produitId, produitData);
      
      if (response.success) {
        await loadPricing(true);
        setEditingProduct(null);
      } else {
        setError(response.error || "Erreur lors de la mise à jour");
      }
    } catch (err) {
      setError("Erreur lors de la mise à jour du produit");
    }
  };

  /**
   * Supprimer un produit
   */
  const handleProductDelete = async (categorie, produitId) => {
    if (!produitId) {
      setError("Impossible de supprimer ce produit (ID manquant)");
      return;
    }

    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) {
      return;
    }

    try {
      setError(null);
      const response = await deleteProduct(categorie, produitId);
      
      if (response.success) {
        setPricing(prev => {
          const updated = { ...prev };
          if (updated.menuPricing[categorie]?.produits) {
            updated.menuPricing[categorie].produits = updated.menuPricing[categorie].produits.filter(
              p => p._id !== produitId
            );
          }
          return updated;
        });
      } else {
        setError(response.error || "Erreur lors de la suppression");
      }
    } catch (err) {
      setError("Erreur lors de la suppression du produit");
    }
  };

  /**
   * Ouvrir le formulaire d'ajout de produit
   */
  const handleOpenProductForm = (categorie) => {
    // Initialiser avec les options par défaut pour les tacos
    const defaultOptions = categorie.toLowerCase() === 'tacos' ? {
      sauces: {
        nom: "Sauces",
        choix: []
      },
      viandes: {
        nom: "Viandes",
        choix: []
      },
      crudites: {
        nom: "Crudités",
        choix: []
      }
    } : {};

    setNewProduct({
      nom: "",
      description: "",
      prixBase: 0,
      taille: "Moyenne",
      disponible: true,
      options: defaultOptions,
      composition: {
        platPrincipal: null
      }
    });
    setShowProductForm(categorie);
  };

  /**
   * Générer automatiquement la description d'un menu
   */
  const generateMenuDescription = (composition) => {
    if (!pricing || !composition) return "";
    
    const parts = [];
    
    // Ajouter le plat principal
    if (composition.platPrincipal) {
      const { categorie, produitId } = composition.platPrincipal;
      const produits = pricing.menuPricing[categorie]?.produits || [];
      const produit = produits.find(p => p._id === produitId);
      if (produit) {
        parts.push(produit.nom);
      }
    }
    
    // Les frites et la boisson sont toujours incluses
    parts.push("Frites");
    parts.push("Boisson au choix");
    
    return parts.join(" + ");
  };

  /**
   * Changer la langue
   */
  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    setLanguageSuccess(true);
    setTimeout(() => setLanguageSuccess(false), 3000);
  };

  /**
   * Ajouter une nouvelle catégorie
   */
  const handleAddCategory = async () => {
    const newCategoryName = prompt("Nom de la nouvelle catégorie:");
    
    if (!newCategoryName || !newCategoryName.trim()) return;

    const categoryKey = newCategoryName.toLowerCase().replace(/\s+/g, '_');
    
    setPricing(prev => ({
      ...prev,
      menuPricing: {
        ...prev.menuPricing,
        [categoryKey]: {
          nom: newCategoryName,
          produits: []
        }
      }
    }));
  };

  // Valeurs calculées
  const safePricing = pricing || {};
  const categories = Object.keys(safePricing.menuPricing || {});

  return {
    // États
    pricing,
    safePricing,
    loading,
    saving,
    error,
    success,
    activeTab,
    editingProduct,
    showProductForm,
    languageSuccess,
    newProduct,
    categories,
    
    // Setters
    setPricing,
    setActiveTab,
    setEditingProduct,
    setShowProductForm,
    setNewProduct,
    setError,
    
    // Actions
    loadPricing,
    handleSave,
    handleInputChange,
    handleProductAdd,
    handleProductUpdate,
    handleProductDelete,
    handleOpenProductForm,
    handleLanguageChange,
    handleAddCategory,
    generateMenuDescription
  };
}




