import React from "react";
import { useTranslation } from "react-i18next";
import { CategorySection } from "./CategorySection";
import "./ConfigurationMenu.scss";

export const ConfigurationMenu = ({
  categories,
  safePricing,
  editingProduct,
  setEditingProduct,
  showProductForm,
  setShowProductForm,
  newProduct,
  setNewProduct,
  generateMenuDescription,
  handleProductAdd,
  handleProductUpdate,
  handleProductDelete,
  handleInputChange,
  handleAddCategory,
  setError
}) => {
  const { t } = useTranslation();
  
  // État local pour gérer l'ouverture/fermeture des catégories
  const [collapsedCategories, setCollapsedCategories] = React.useState({});
  
  // État pour le filtre de recherche des produits dans les menus
  const [searchFilter, setSearchFilter] = React.useState("");
  
  // Fonction pour toggle une catégorie
  const toggleCategory = (categorie) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categorie]: !prev[categorie]
    }));
  };

  return (
    <div className="menu-pricing">
      <h3>{t('configuration.menu.title')}</h3>
      <div className="categories-container">
        {categories.length === 0 ? (
          <p>{t('configuration.menu.noCategories')}</p>
        ) : (
          categories.map((categorie) => {
            const categorieData = safePricing.menuPricing?.[categorie] || {};

            return (
              <CategorySection
                key={categorie}
                categorie={categorie}
                categorieData={categorieData}
                isCollapsed={collapsedCategories[categorie]}
                onToggleCollapse={() => toggleCategory(categorie)}
                showProductForm={showProductForm === categorie}
                onOpenProductForm={() => setShowProductForm(categorie)}
                newProduct={newProduct}
                setNewProduct={setNewProduct}
                searchFilter={searchFilter}
                setSearchFilter={setSearchFilter}
                safePricing={safePricing}
                generateMenuDescription={generateMenuDescription}
                onProductAdd={() => handleProductAdd(categorie)}
                onCancelProductForm={() => setShowProductForm(false)}
                editingProduct={editingProduct}
                setEditingProduct={setEditingProduct}
                handleInputChange={handleInputChange}
                handleProductUpdate={handleProductUpdate}
                handleProductDelete={handleProductDelete}
                setError={setError}
              />
            );
          })
        )}
        
        <div className="categories-actions">
          <button onClick={handleAddCategory} className="btn-addCategories">
            {t('configuration.menu.addCategory')}
          </button>
        </div>
      </div>
    </div>
  );
};

