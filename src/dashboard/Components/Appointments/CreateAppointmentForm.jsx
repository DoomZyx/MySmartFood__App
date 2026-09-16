import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import { fetchPricing } from "../../API/Pricing/api";
import { choiceName, computeUnitPrice, formatChoiceLabel } from "../../utils/menuOptions";

export function CreateAppointmentForm({ onSubmit, onCancel, loading, appointmentType }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    nom: "",
    date: "",
    heure: "",
    type: appointmentType || "",
    nombrePersonnes: "",
    description: "",
  });

  const [errors, setErrors] = useState({});
  const [menuProducts, setMenuProducts] = useState([]); // produits depuis la config
  const [boissonsDisponibles, setBoissonsDisponibles] = useState([]); // boissons depuis la config
  const [selectedItems, setSelectedItems] = useState([
    { id: Date.now(), productId: "", qty: 1, composition: "", options: {} }
  ]);
  const [searchFilter, setSearchFilter] = useState(""); // Pour filtrer les produits
  const [showProductSelection, setShowProductSelection] = useState(null); // ID de l'item en cours de sélection

  // Charger les produits depuis la configuration Pricing
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await fetchPricing();
        const pricing = res?.data || res; // selon structure
        const menu = pricing?.menuPricing || {};
        
        // Créer un index de tous les produits par _id pour faciliter la recherche
        const produitsIndex = {};
        Object.entries(menu).forEach(([key, cat]) => {
          const produits = Array.isArray(cat?.produits) ? cat.produits : [];
          produits.forEach(p => {
            if (p._id) {
              produitsIndex[p._id] = p;
            }
          });
        });
        
        // Aplatir {categorie: { produits: [] }} en liste unique
        const flattened = Object.entries(menu).flatMap(([key, cat]) => {
          const produits = Array.isArray(cat?.produits) ? cat.produits : [];
          return produits.map((p) => {
            const product = {
              _id: p._id || `${key}-${p.nom}`,
              nom: p.nom,
              categorie: cat?.nom || key,
              prixBase: p.prixBase,
              options: p.options || {}, // Inclure les options personnalisables
              composition: p.composition || null,
              boissonsDisponibles: p.boissonsDisponibles || [], // Boissons pour les menus
            };
            
            // Si c'est un menu avec un plat principal, récupérer les options du plat principal
            if (p.composition && p.composition.platPrincipal && p.composition.platPrincipal.produitId) {
              const platPrincipal = produitsIndex[p.composition.platPrincipal.produitId];
              if (platPrincipal && platPrincipal.options && Object.keys(platPrincipal.options).length > 0) {
                // Ajouter les options du plat principal au menu
                product.options = { ...platPrincipal.options };
                product.platPrincipalNom = platPrincipal.nom;
              }
            }
            
            return product;
          });
        });
        setMenuProducts(flattened);

        const boissonsCategorie = menu['Boissons'] || menu['boissons'];
        if (boissonsCategorie && Array.isArray(boissonsCategorie.produits)) {
          const boissons = boissonsCategorie.produits.map(b => b.nom);
          setBoissonsDisponibles(boissons);
        }
      } catch (e) {
        setMenuProducts([]);
      }
    };
    loadProducts();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Effacer l'erreur si elle existe
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.nom.trim()) newErrors.nom = t('createAppointment.errors.enterClientName');
    if (!formData.date) newErrors.date = t('createAppointment.errors.selectDate');
    if (!formData.heure) newErrors.heure = t('createAppointment.errors.selectTime');
    if (!formData.type) newErrors.type = t('createAppointment.errors.selectType');
    
    // Validation du nombre de personnes pour les réservations
    if (formData.type === "Réservation de table") {
      if (!formData.nombrePersonnes || formData.nombrePersonnes < 1) {
        newErrors.nombrePersonnes = t('createAppointment.errors.enterPersons');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      // Ne pas envoyer le champ client s'il est vide
      const payload = { ...formData };
      delete payload.client; // Supprimer le champ client pour éviter les erreurs de validation
      
      // Mapper type vers modalite
      if (formData.type === "Commande à emporter") {
        payload.modalite = "À emporter";
      } else if (formData.type === "Réservation de table") {
        payload.modalite = "Sur place";
      }
      
      // Nettoyer nombrePersonnes : convertir en integer ou supprimer si vide
      if (payload.nombrePersonnes === "" || payload.nombrePersonnes === null || payload.nombrePersonnes === undefined) {
        delete payload.nombrePersonnes;
      } else {
        payload.nombrePersonnes = parseInt(payload.nombrePersonnes, 10);
      }
      
      // Si commande à emporter: structurer les commandes dans un champ dédié
      if (formData.type === "Commande à emporter") {
        const commandes = selectedItems
          .filter(it => it.productId)
          .map((it) => {
            const prod = menuProducts.find(p => p._id === it.productId);
            return {
              produitId: it.productId,
              nom: prod?.nom || "Plat inconnu",
              categorie: prod?.categorie || "",
              quantite: it.qty && it.qty > 0 ? it.qty : 1,
              prixUnitaire: computeUnitPrice(prod?.prixBase || 0, prod?.options, it.options),
              composition: it.composition?.trim() || "",
              options: it.options || {} // Inclure les options sélectionnées
            };
          });
        
        if (commandes.length > 0) {
          payload.commandes = commandes;
        }
      }
      
      onSubmit(payload);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="appointment-form">
      <div className="form-grid">
        {/* Nom du client (texte) */}
        <div className="form-group">
          <label htmlFor="nom">{t('createAppointment.clientName')}</label>
          <input
            type="text"
            id="nom"
            name="nom"
            placeholder="Ex: Axel Cella"
            value={formData.nom}
            onChange={handleChange}
            className={errors.nom ? "error" : ""}
          />
          {errors.nom && <span className="error-message">{errors.nom}</span>}
        </div>

        {/* Date */}
        <div className="form-group">
          <label htmlFor="date">{t('createAppointment.date')}</label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            className={errors.date ? "error" : ""}
            min={new Date().toISOString().split('T')[0]}
          />
          {errors.date && <span className="error-message">{errors.date}</span>}
        </div>

        {/* Heure */}
        <div className="form-group">
          <label htmlFor="heure">{t('createAppointment.time')} *</label>
          <input
            type="time"
            id="heure"
            name="heure"
            value={formData.heure}
            onChange={handleChange}
            className={errors.heure ? "error" : ""}
          />
          {errors.heure && <span className="error-message">{errors.heure}</span>}
        </div>

        {/* Type - Masqué si appointmentType est fourni */}
        {!appointmentType && (
          <div className="form-group">
            <label htmlFor="type">{t('createAppointment.orderType')}</label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className={errors.type ? "error" : ""}
            >
              <option value="">{t('createAppointment.selectType')}</option>
              <option value="Commande à emporter">{t('createAppointment.takeaway')}</option>
              <option value="Réservation de table">{t('createAppointment.reservation')}</option>
            </select>
            {errors.type && <span className="error-message">{errors.type}</span>}
          </div>
        )}

        {/* Nombre de personnes (uniquement pour les réservations) */}
        {formData.type === "Réservation de table" && (
          <div className="form-group">
            <label htmlFor="nombrePersonnes">{t('createAppointment.persons')} *</label>
            <input
              type="number"
              id="nombrePersonnes"
              name="nombrePersonnes"
              value={formData.nombrePersonnes}
              onChange={handleChange}
              onFocus={(e) => e.target.select()}
              className={errors.nombrePersonnes ? "error" : ""}
              min="1"
              max="100"
              placeholder="Ex: 4"
            />
            {errors.nombrePersonnes && <span className="error-message">{errors.nombrePersonnes}</span>}
          </div>
        )}
      </div>

      {/* Sélection de plats (multiples) si commande à emporter */}
      {formData.type === "Commande à emporter" && (
        <div className="form-group full-width" style={{ marginTop: '20px' }}>
          <label>{t('createAppointment.orderedDishes')}</label>
          <div className="items-list">
            {selectedItems.map((item, idx) => {
              const selectedProduct = menuProducts.find(p => p._id === item.productId);
              const hasOptions = selectedProduct && Object.keys(selectedProduct.options || {}).length > 0;
              const unitPrice = selectedProduct
                ? computeUnitPrice(selectedProduct.prixBase, selectedProduct.options, item.options)
                : 0;
              
              return (
                <div key={item.id} className="item-row-container">
                  <div className="item-row">
                    {/* Bouton pour ouvrir la sélection de produit */}
                    <button
                      type="button"
                      className="product-select-btn"
                      onClick={() => {
                        setShowProductSelection(item.id);
                        setSearchFilter("");
                      }}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '12px 16px',
                        background: 'rgba(255, 255, 255, 0.5)',
                        border: '2px solid rgba(0, 0, 0, 0.15)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        minWidth: '250px',
                        textAlign: 'left'
                      }}
                    >
                      {selectedProduct ? (
                        <>
                          <span className="product-category" style={{ color: '#6b7280', fontSize: '0.85rem', fontWeight: 600 }}>{selectedProduct.categorie}</span>
                          <span className="product-name" style={{ color: '#1f2937', fontWeight: 700 }}>{selectedProduct.nom}</span>
                          <span className="product-price" style={{ marginLeft: 'auto', color: '#6366f1', fontWeight: 700, fontSize: '1.1rem' }}>{unitPrice.toFixed(2)}€</span>
                        </>
                      ) : (
                        <span className="product-placeholder" style={{ color: '#9ca3af', fontSize: '1rem' }}>
                          {t('createAppointment.selectDish')}
                        </span>
                      )}
                    </button>
                    
                    <input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(e) => setSelectedItems(prev => prev.map(it => it.id === item.id ? { ...it, qty: Math.max(1, parseInt(e.target.value || '1')) } : it))}
                      onFocus={(e) => e.target.select()}
                      className="item-qty"
                      placeholder={t('createAppointment.qty')}
                    />
                    {selectedItems.length > 1 && (
                      <button 
                        type="button" 
                        className="btn-secondary btn-remove" 
                        onClick={() => setSelectedItems(prev => prev.filter(it => it.id !== item.id))}
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </div>

                  {/* Choix de boisson pour les menus */}
                  {(() => {
                    const isMenu = selectedProduct && (
                      selectedProduct.categorie?.toLowerCase().includes('menu') || 
                      selectedProduct.nom?.toLowerCase().includes('menu')
                    );
                    return isMenu && (
                      <div className="item-options" style={{ marginTop: '10px' }}>
                        <div className="option-group">
                          <label className="option-label">Boisson incluse *</label>
                          <select
                            value={item.options?.boisson || ''}
                            onChange={(e) => setSelectedItems(prev => prev.map(it => 
                              it.id === item.id 
                                ? { ...it, options: { ...it.options, boisson: e.target.value } } 
                                : it
                            ))}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1px solid #ddd',
                              width: '100%',
                              maxWidth: '300px'
                            }}
                          >
                            <option value="">Choisir une boisson</option>
                            {selectedProduct.boissonsDisponibles && selectedProduct.boissonsDisponibles.length > 0 ? (
                              // Utiliser les boissons configurées pour ce menu spécifique
                              selectedProduct.boissonsDisponibles.map((boisson, idx) => (
                                <option key={idx} value={boisson}>{boisson}</option>
                              ))
                            ) : boissonsDisponibles.length > 0 ? (
                              // Fallback: toutes les boissons de la catégorie
                              boissonsDisponibles.map((boisson, idx) => (
                                <option key={idx} value={boisson}>{boisson}</option>
                              ))
                            ) : (
                              // Fallback ultime si rien n'est configuré
                              <>
                                <option value="Coca-Cola">Coca-Cola</option>
                                <option value="Ice Tea">Ice Tea</option>
                                <option value="Fanta">Fanta</option>
                                <option value="Sprite">Sprite</option>
                                <option value="Eau">Eau</option>
                              </>
                            )}
                          </select>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Options personnalisables */}
                  {hasOptions && (
                    <div className="item-options">
                      {selectedProduct.platPrincipalNom && (
                        <div className="options-header-info">
                          <strong>Personnalisation du {selectedProduct.platPrincipalNom}</strong>
                        </div>
                      )}
                      {Object.entries(selectedProduct.options).map(([optionKey, optionData]) => (
                        <div key={optionKey} className="option-group">
                          <label className="option-label">
                            {optionData.nom}
                            {optionData.obligatoire && <span className="required">*</span>}
                          </label>
                          <div className="option-choices">
                            {(optionData.choix || []).map((choix, choixIdx) => {
                              const nom = choiceName(choix);
                              return (
                              <label key={`${nom}-${choixIdx}`} className="choice-label">
                                <input
                                  type={optionData.multiple ? "checkbox" : "radio"}
                                  name={`${item.id}-${optionKey}`}
                                  value={nom}
                                  checked={
                                    optionData.multiple
                                      ? (item.options[optionKey] || []).includes(nom)
                                      : item.options[optionKey] === nom
                                  }
                                  onChange={(e) => {
                                    setSelectedItems(prev => prev.map(it => {
                                      if (it.id !== item.id) return it;
                                      
                                      const newOptions = { ...it.options };
                                      if (optionData.multiple) {
                                        const current = newOptions[optionKey] || [];
                                        if (e.target.checked) {
                                          newOptions[optionKey] = [...current, nom];
                                        } else {
                                          newOptions[optionKey] = current.filter(c => c !== nom);
                                        }
                                      } else {
                                        newOptions[optionKey] = nom;
                                      }
                                      
                                      return { ...it, options: newOptions };
                                    }));
                                  }}
                                />
                                {formatChoiceLabel(choix)}
                              </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Champ suppléments (notes supplémentaires) */}
                  {!hasOptions && (
                    <input
                      type="text"
                      placeholder={t('createAppointment.compositionPlaceholder')}
                      value={item.composition}
                      onChange={(e) => setSelectedItems(prev => prev.map(it => it.id === item.id ? { ...it, composition: e.target.value } : it))}
                      className="item-composition"
                    />
                  )}
                </div>
              );
            })}
            <div className="add-item-container">
              <button 
                type="button" 
                className="btn-secondary btn-add-item" 
                onClick={() => setSelectedItems(prev => [...prev, { id: Date.now() + Math.random(), productId: "", qty: 1, composition: "", options: {} }])}
              >
                {t('createAppointment.addDish')}
              </button>
            </div>
          </div>
          <small>{t('createAppointment.dishesNote')}</small>
        </div>
      )}

      {/* Description */}
      <div className="form-group full-width">
        <label htmlFor="description">{t('createAppointment.description')}</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder={t('createAppointment.descriptionPlaceholder')}
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="form-actions">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          disabled={loading}
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
        >
          {loading ? ` ${t('createAppointment.creating')}` : `${t('createAppointment.createButton')}`}
        </button>
      </div>

      {/* Modal de sélection de produit avec cartes - Rendu via Portal */}
      {showProductSelection && ReactDOM.createPortal(
        <div className="product-selection-overlay" onClick={() => setShowProductSelection(null)}>
          <div className="product-selection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-appointment">
              <h3>🍽️ {t('createAppointment.selectDish')}</h3>
              <button 
                type="button" 
                className="close-modal-btn" 
                onClick={() => setShowProductSelection(null)}
              >
                ✕
              </button>
            </div>

            {/* Input de recherche */}
            <div className="search-filter">
              <input
                type="text"
                placeholder={t('common.search') + "..."}
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                autoFocus
              />
            </div>

            {/* Cartes de produits par catégorie */}
            <div className="products-by-category">
              {Object.entries(
                menuProducts
                  .filter(p => 
                    p.nom.toLowerCase().includes(searchFilter.toLowerCase()) ||
                    p.categorie.toLowerCase().includes(searchFilter.toLowerCase())
                  )
                  .reduce((acc, product) => {
                    if (!acc[product.categorie]) {
                      acc[product.categorie] = [];
                    }
                    acc[product.categorie].push(product);
                    return acc;
                  }, {})
              ).map(([categorie, products]) => (
                <div key={categorie} className="category-section">
                  <h4 className="category-title">{categorie}</h4>
                  <div className="product-cards">
                    {products.map(product => (
                      <div
                        key={product._id}
                        className="product-card"
                        onClick={() => {
                          setSelectedItems(prev => prev.map(it => 
                            it.id === showProductSelection 
                              ? { ...it, productId: product._id, options: {} } 
                              : it
                          ));
                          setShowProductSelection(null);
                          setSearchFilter("");
                        }}
                      >
                        <div className="card-name">{product.nom}</div>
                        <div className="card-price">{product.prixBase?.toFixed?.(2) || product.prixBase}€</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {menuProducts.filter(p => 
              p.nom.toLowerCase().includes(searchFilter.toLowerCase()) ||
              p.categorie.toLowerCase().includes(searchFilter.toLowerCase())
            ).length === 0 && (
              <div className="no-results">
                Aucun produit trouvé pour "{searchFilter}"
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </form>
  );
}
