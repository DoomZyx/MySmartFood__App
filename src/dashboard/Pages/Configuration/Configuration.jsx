import React from "react";
import { useTranslation } from "react-i18next";
import AppLayout from "../../Components/Layout/AppLayout";
import { useConfiguration } from "../../Hooks/Configuration/useConfiguration";
import { ConfigurationRestaurant } from "../../Components/Configuration/ConfigurationRestaurant";
import { ConfigurationLanguage } from "../../Components/Configuration/ConfigurationLanguage";
import { ConfigurationHoraires } from "../../Components/Configuration/ConfigurationHoraires";
import { ConfigurationMenu } from "../../Components/Configuration/ConfigurationMenu";
import "./Configuration.scss";

function Configuration() {
  const { t } = useTranslation();
  
  // Utiliser le hook qui contient toute la logique
  const {
    // États
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
    setActiveTab,
    setEditingProduct,
    setShowProductForm,
    setNewProduct,
    setError,
    
    // Actions
    handleSave,
    handleInputChange,
    handleProductAdd,
    handleProductUpdate,
    handleProductDelete,
    handleOpenProductForm,
    handleLanguageChange,
    handleAddCategory,
    generateMenuDescription
  } = useConfiguration();

  // Affichage du chargement
  if (loading) {
    return (
      <AppLayout>
        <div className="configuration-page">
          <div className="loading">{t('common.loading')}</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="configuration-page">
        
        {error && (
          <div className="notification-toast error-message">
            <i className="bi bi-exclamation-triangle-fill"></i>
            <span className="message-content">{error}</span>
          </div>
        )}

        <div className="tabs">
          <button 
            className={activeTab === "restaurant" ? "active" : ""}
            onClick={() => setActiveTab("restaurant")}
          >
            {t('configuration.tabs.restaurant')}
          </button>
          <button 
            className={activeTab === "menu" ? "active" : ""}
            onClick={() => setActiveTab("menu")}
          >
            {t('configuration.tabs.menu')}
          </button>
          <button 
            className={activeTab === "horaires" ? "active" : ""}
            onClick={() => setActiveTab("horaires")}
          >
            {t('configuration.tabs.hours')}
          </button>
          <button 
            className={activeTab === "langue" ? "active" : ""}
            onClick={() => setActiveTab("langue")}
          >
            {t('configuration.tabs.language')}
          </button>
        </div>

        <div className="tab-content">
          {/* TAB RESTAURANT */}
          {activeTab === "restaurant" && (
            <ConfigurationRestaurant 
              safePricing={safePricing}
              handleInputChange={handleInputChange}
            />
          )}

          {/* TAB MENU */}
          {activeTab === "menu" && (
            <ConfigurationMenu
              categories={categories}
              safePricing={safePricing}
              editingProduct={editingProduct}
              setEditingProduct={setEditingProduct}
              showProductForm={showProductForm}
              setShowProductForm={setShowProductForm}
              newProduct={newProduct}
              setNewProduct={setNewProduct}
              generateMenuDescription={generateMenuDescription}
              handleProductAdd={handleProductAdd}
              handleProductUpdate={handleProductUpdate}
              handleProductDelete={handleProductDelete}
              handleInputChange={handleInputChange}
              handleAddCategory={handleAddCategory}
              setError={setError}
            />
          )}

          {/* TAB HORAIRES */}
          {activeTab === "horaires" && (
            <ConfigurationHoraires 
              safePricing={safePricing}
              handleInputChange={handleInputChange}
            />
          )}

          {/* TAB LANGUE */}
          {activeTab === "langue" && (
            <ConfigurationLanguage 
              languageSuccess={languageSuccess}
              handleLanguageChange={handleLanguageChange}
            />
          )}
        </div>


        {success && (
          <div className="notification-toast success-message">
            <i className="bi bi-check-circle-fill"></i>
            <span className="message-content">{t('common.success')}</span>
          </div>
        )}

        {/* Bouton de sauvegarde global */}
        <div className="save-section">
            <button 
              onClick={handleSave} 
              disabled={saving}
            className="save-btn"
            >
            {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
      </div>
    </AppLayout>
  );
}

export default Configuration;

