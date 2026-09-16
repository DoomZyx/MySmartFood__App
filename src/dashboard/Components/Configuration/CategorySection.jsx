import React from "react";
import { useTranslation } from "react-i18next";
import { ProductForm } from "./ProductForm";
import { ProductItem } from "./ProductItem";
import "./CategorySection.scss";

export const CategorySection = ({
  categorie,
  categorieData,
  isCollapsed,
  onToggleCollapse,
  showProductForm,
  onOpenProductForm,
  newProduct,
  setNewProduct,
  searchFilter,
  setSearchFilter,
  safePricing,
  generateMenuDescription,
  onProductAdd,
  onCancelProductForm,
  editingProduct,
  setEditingProduct,
  handleInputChange,
  handleProductUpdate,
  handleProductDelete,
  setError
}) => {
  const { t } = useTranslation();
  const produits = categorieData.produits || [];

  const handleProductChange = (index, field, value) => {
    const updated = [...produits];
    updated[index] = { ...produits[index], [field]: value };
    handleInputChange(`menuPricing.${categorie}.produits`, updated);
  };

  const handleSaveProduct = (index) => {
    const updatedProduits = safePricing.menuPricing[categorie]?.produits || [];
    const updatedProduit = updatedProduits[index];
    const originalProduit = produits[index];
    
    if (updatedProduit) {
      const productId = updatedProduit._id || originalProduit._id;
      
      if (!productId) {
        setError('Erreur: ID du produit manquant');
        return;
      }
      
      // Nettoyer les données
      const { _id, __v, ...cleanData } = updatedProduit;
      
      const produitToSave = {
        nom: cleanData.nom?.trim() || '',
        description: cleanData.description?.trim() || '',
        prixBase: parseFloat(cleanData.prixBase || cleanData.prix || 0),
        disponible: Boolean(cleanData.disponible !== false),
        ...(cleanData.taille && { taille: cleanData.taille }),
        ...(cleanData.options && { options: cleanData.options })
      };
      
      handleProductUpdate(categorie, productId, produitToSave);
    }
  };

  return (
    <div className={`category-section ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="category-header">
        <div className="category-header-left">
          <button 
            onClick={onToggleCollapse}
            className="btn-collapse"
            aria-label={isCollapsed ? 'Ouvrir' : 'Fermer'}
          >
            <i className={`bi bi-chevron-${isCollapsed ? 'right' : 'down'}`}></i>
          </button>
          <h4>{categorieData.nom || categorie}</h4>
        </div>
        <button 
          onClick={onOpenProductForm}
          className="btn-addProduct"
        >
          {t('configuration.menu.addProduct')}
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="category-content">
          {showProductForm && (
            <ProductForm 
              categorie={categorie}
              newProduct={newProduct}
              setNewProduct={setNewProduct}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
              safePricing={safePricing}
              generateMenuDescription={generateMenuDescription}
              onSubmit={onProductAdd}
              onCancel={onCancelProductForm}
            />
          )}

          <div className="products-list">
            {produits.length === 0 ? (
              <p className="no-products">{t('configuration.menu.noProducts')}</p>
            ) : (
              produits.map((produit, index) => (
                <ProductItem
                  key={produit._id || index}
                  produit={produit}
                  index={index}
                  categorie={categorie}
                  isEditing={editingProduct?.categorie === categorie && editingProduct?.index === index}
                  onStartEdit={() => setEditingProduct({ categorie, index })}
                  onSave={() => handleSaveProduct(index)}
                  onCancel={() => setEditingProduct(null)}
                  onDelete={() => {
                    if (!produit._id) {
                      setError('Impossible de supprimer: produit sans ID. Veuillez recharger la page.');
                      return;
                    }
                    handleProductDelete(categorie, produit._id);
                  }}
                  onChange={(field, value) => handleProductChange(index, field, value)}
                  safePricing={safePricing}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

