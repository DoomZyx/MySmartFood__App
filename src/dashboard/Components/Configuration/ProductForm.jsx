import React from "react";
import { useTranslation } from "react-i18next";
import { CustomOptionsSection } from "./CustomOptionsSection";
import "./ProductForm.scss";

export function ProductForm({ 
  categorie, 
  newProduct, 
  setNewProduct, 
  searchFilter,
  setSearchFilter,
  safePricing,
  generateMenuDescription,
  onSubmit, 
  onCancel 
}) {
  const { t } = useTranslation();

  return (
    <div className="product-form">
      <div className="form-header">
        <h5>{t('configuration.menu.newProduct')}</h5>
        <button 
          type="button"
          className="close-form-btn"
          onClick={onCancel}
          title="Fermer"
        >
          ✕
        </button>
      </div>
      <div className="form-row">
        <input
          type="text"
          placeholder={t('configuration.menu.productName')}
          value={newProduct.nom}
          onChange={(e) => setNewProduct({ ...newProduct, nom: e.target.value })}
        />
        <input
          type="text"
          placeholder={t('configuration.menu.description')}
          value={newProduct.description}
          onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
        />
        <input
          type="number"
          placeholder={t('configuration.menu.price')}
          value={newProduct.prixBase}
          onChange={(e) => setNewProduct({ ...newProduct, prixBase: parseFloat(e.target.value) || 0 })}
          onFocus={(e) => e.target.select()}
          min="0"
          step="0.01"
        />
      </div>
      
      {/* Options personnalisables - uniquement pour les Tacos */}
      <CustomOptionsSection 
        categorie={categorie}
        options={newProduct.options}
        onUpdateOptions={(newOptions) => setNewProduct({ ...newProduct, options: newOptions })}
      />

      {/* Composition de menu - uniquement pour les Menus */}
      {categorie.toLowerCase() === 'menus' && (
        <div className="menu-composition-wrapper">
          <div className="options-header">
            <h6>{t('configuration.menu.menuComposition')}</h6>
            <p>Sélectionnez le plat principal. Les frites et la boisson sont automatiquement incluses.</p>
          </div>

          {/* Input de recherche */}
          <div className="search-filter">
            <input
              type="text"
              placeholder={t('common.search') + "..."}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
          
          {/* Plat principal */}
          <div className="composition-section">
            <label>{t('configuration.menu.mainDish')}</label>
            <div className="product-cards">
              {Object.keys(safePricing.menuPricing || {})
                .filter(cat => !['boissons', 'menus', 'desserts', 'accompagnements'].includes(cat.toLowerCase()))
                .map(cat => {
                  const category = safePricing.menuPricing[cat];
                  return category.produits?.filter(p => p.disponible && p.nom.toLowerCase().includes(searchFilter.toLowerCase())).map(produit => (
                    <div 
                      key={produit._id}
                      className={`product-card ${newProduct.composition?.platPrincipal?.produitId === produit._id ? 'selected' : ''}`}
                      onClick={() => {
                        setNewProduct({
                          ...newProduct,
                          composition: {
                            platPrincipal: { categorie: cat, produitId: produit._id }
                          },
                          description: generateMenuDescription({
                            platPrincipal: { categorie: cat, produitId: produit._id }
                          })
                        });
                      }}
                    >
                      <div className="card-name">{produit.nom}</div>
                      <div className="card-price">{produit.prixBase}€</div>
                    </div>
                  ));
                })}
            </div>
          </div>

          {/* Boissons disponibles */}
          <div className="composition-section" style={{ marginTop: '20px' }}>
            <label>Boissons disponibles pour ce menu</label>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '10px' }}>
              Sélectionnez les boissons que le client peut choisir pour ce menu
            </p>
            <div className="boissons-selection">
              {Object.keys(safePricing.menuPricing || {})
                .filter(cat => cat.toLowerCase() === 'boissons')
                .map(cat => {
                  const category = safePricing.menuPricing[cat];
                  return category.produits?.map(boisson => {
                    const isSelected = newProduct.boissonsDisponibles?.includes(boisson.nom);
                    return (
                      <label key={boisson._id} className="boisson-checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const currentBoissons = newProduct.boissonsDisponibles || [];
                            const updated = e.target.checked
                              ? [...currentBoissons, boisson.nom]
                              : currentBoissons.filter(b => b !== boisson.nom);
                            setNewProduct({
                              ...newProduct,
                              boissonsDisponibles: updated
                            });
                          }}
                        />
                        <span>{boisson.nom}</span>
                      </label>
                    );
                  });
                })}
            </div>
          </div>

          {/* Description générée */}
          {newProduct.description && (
            <div className="auto-description">
              <strong>{t('configuration.menu.autoDescription')} :</strong> {newProduct.description}
            </div>
          )}
        </div>
      )}
      
      <div className="form-actions">
        <button onClick={onSubmit}>
          {t('common.add')}
        </button>
        <button onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}



